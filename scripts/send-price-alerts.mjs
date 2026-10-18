import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { formatOfferPrice, getVerifiedActiveOffers, ruleMatchesOffer, saoPauloDate } from "./offer-matcher.mjs";

const requiredEnvironment = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "SITE_URL",
];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
if (missingEnvironment.length > 0) {
  throw new Error(`Missing required environment: ${missingEnvironment.join(", ")}`);
}

const siteUrl = new URL(process.env.SITE_URL);
if (siteUrl.protocol !== "https:") throw new Error("SITE_URL must use HTTPS.");

webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function readRows(queryFactory) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await queryFactory().range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

const [feedText, sourceStateText] = await Promise.all([
  readFile(new URL("../offers.json", import.meta.url), "utf8"),
  readFile(new URL("../.offer-monitor-state.json", import.meta.url), "utf8"),
]);
const feed = JSON.parse(feedText);
const sourceState = JSON.parse(sourceStateText);
const today = saoPauloDate();
const offers = getVerifiedActiveOffers(feed.offers, sourceState, today);

const rules = await readRows(() => supabase.from("alert_rules")
  .select("id, user_id, store, product, product_type, target_price")
  .eq("enabled", true));
const userIds = [...new Set(rules.map((rule) => rule.user_id))];
if (userIds.length === 0) {
  console.log(JSON.stringify({ date: today, activeVerifiedOffers: offers.length, usersMatched: 0, notificationsSent: 0 }));
  process.exit(0);
}

const profiles = await readRows(() => supabase.from("profiles")
  .select("user_id, notifications_paused")
  .in("user_id", userIds));
const activeUserIds = new Set(profiles.filter((profile) => !profile.notifications_paused).map((profile) => profile.user_id));
const subscriptions = await readRows(() => supabase.from("push_subscriptions")
  .select("id, user_id, endpoint, p256dh, auth_key")
  .in("user_id", userIds));
const matchedByUser = new Map();
for (const rule of rules) {
  if (!activeUserIds.has(rule.user_id)) continue;
  for (const offer of offers) {
    if (!ruleMatchesOffer(rule, offer)) continue;
    const matches = matchedByUser.get(rule.user_id) ?? new Map();
    matches.set(offer.id, offer);
    matchedByUser.set(rule.user_id, matches);
  }
}

const matchedOfferIds = [...new Set([...matchedByUser.values()].flatMap((matches) => [...matches.keys()]))];
if (matchedOfferIds.length === 0) {
  console.log(JSON.stringify({ date: today, activeVerifiedOffers: offers.length, usersMatched: 0, notificationsSent: 0 }));
  process.exit(0);
}
const matchedUserIds = [...matchedByUser.keys()];
const previousLogs = await readRows(() => supabase.from("notification_log")
  .select("user_id, offer_id, result")
  .in("user_id", matchedUserIds)
  .in("offer_id", matchedOfferIds));
const alreadySent = new Set(previousLogs.filter((entry) => entry.result === "sent").map((entry) => `${entry.user_id}:${entry.offer_id}`));
const subscriptionGroups = Map.groupBy(subscriptions, (subscription) => subscription.user_id);
const expiredSubscriptionIds = new Set();
let notificationsSent = 0;
let notificationsFailed = 0;

for (const [userId, userOffers] of matchedByUser) {
  const userSubscriptions = subscriptionGroups.get(userId) ?? [];
  if (userSubscriptions.length === 0) continue;
  for (const offer of userOffers.values()) {
    if (alreadySent.has(`${userId}:${offer.id}`)) continue;
    const offerUrl = new URL(`index.html?offer=${encodeURIComponent(offer.id)}`, siteUrl);
    const payload = JSON.stringify({
      title: `${offer.store}: oferta para você`,
      body: `${offer.name} por ${formatOfferPrice(offer.price)} · válida até ${offer.validTo}.`,
      url: offerUrl.href,
      tag: `feira-${offer.id}`,
    });
    let delivered = false;
    let safeErrorCode = null;
    for (const subscription of userSubscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
        }, payload, { TTL: 60 * 60 * 24 });
        delivered = true;
      } catch (error) {
        const statusCode = Number(error?.statusCode);
        safeErrorCode = statusCode ? `push_${statusCode}` : "push_delivery_error";
        if (statusCode === 404 || statusCode === 410) expiredSubscriptionIds.add(subscription.id);
      }
    }
    const { error } = await supabase.from("notification_log").upsert({
      user_id: userId,
      offer_id: offer.id,
      result: delivered ? "sent" : "failed",
      error_code: delivered ? null : safeErrorCode,
    }, { onConflict: "user_id,offer_id" });
    if (error) throw error;
    if (delivered) notificationsSent += 1;
    else notificationsFailed += 1;
  }
}

if (expiredSubscriptionIds.size > 0) {
  const { error } = await supabase.from("push_subscriptions").delete().in("id", [...expiredSubscriptionIds]);
  if (error) throw error;
}
console.log(JSON.stringify({
  date: today,
  activeVerifiedOffers: offers.length,
  usersMatched: matchedByUser.size,
  notificationsSent,
  notificationsFailed,
  expiredSubscriptionsRemoved: expiredSubscriptionIds.size,
}));
