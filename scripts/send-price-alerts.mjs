import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import {
  MAX_SOURCE_AGE_MS,
  formatOfferPrice,
  getVerifiedActiveOffers,
  ruleMatchesOffer,
  saoPauloDate,
} from "./offer-matcher.mjs";

const MAX_FEED_AGE_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const IN_CHUNK_SIZE = 100;
const dryRun = process.argv.includes("--dry-run");

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

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

async function readRows(queryFactory, orderColumns = ["id"]) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = queryFactory();
    for (const column of orderColumns) query = query.order(column);
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function readRowsIn(queryFactory, column, values, orderColumns = ["id"]) {
  const unique = [...new Set(values.filter(Boolean))];
  const rows = [];
  for (const group of chunk(unique, IN_CHUNK_SIZE)) {
    rows.push(...await readRows(() => queryFactory().in(column, group), orderColumns));
  }
  return rows;
}

const [feedText, sourceStateText] = await Promise.all([
  readFile(new URL("../offers.json", import.meta.url), "utf8"),
  readFile(new URL("../.offer-monitor-state.json", import.meta.url), "utf8"),
]);
const feed = JSON.parse(feedText);
const sourceState = JSON.parse(sourceStateText);
const today = saoPauloDate();
const feedUpdatedAt = Date.parse(feed.updatedAt);
if (!Number.isFinite(feedUpdatedAt)) throw new Error("offers.json has no valid updatedAt timestamp.");

const rules = await readRows(() => supabase.from("alert_rules")
  .select("id, user_id, store, product, product_type, target_price")
  .eq("enabled", true), ["id"]);
if (rules.length === 0) {
  console.log(JSON.stringify({ date: today, activeOffers: 0, activeVerifiedOffers: 0, usersMatched: 0, notificationsSent: 0, dryRun }));
  process.exit(0);
}
if (Date.now() - feedUpdatedAt > MAX_FEED_AGE_MS) {
  throw new Error(`Offer feed is older than 24 hours (updatedAt=${feed.updatedAt}).`);
}

const activeOffers = feed.offers.filter((offer) => offer.validFrom <= today && offer.validTo >= today);
const offers = getVerifiedActiveOffers(feed.offers, sourceState, today);
if (activeOffers.length > 0 && offers.length === 0) {
  throw new Error("No verified active offers. Review changed sources and clear needs_review before sending alerts.");
}

const userIds = [...new Set(rules.map((rule) => rule.user_id))];
const profiles = await readRowsIn(() => supabase.from("profiles")
  .select("user_id, notifications_paused"), "user_id", userIds, ["user_id"]);
const activeUserIds = new Set(profiles.filter((profile) => !profile.notifications_paused).map((profile) => profile.user_id));
const subscriptions = await readRowsIn(() => supabase.from("push_subscriptions")
  .select("id, user_id, endpoint, p256dh, auth_key"), "user_id", userIds, ["id"]);
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
  console.log(JSON.stringify({
    date: today,
    feedUpdatedAt: feed.updatedAt,
    activeOffers: activeOffers.length,
    activeVerifiedOffers: offers.length,
    usersMatched: 0,
    notificationsSent: 0,
    dryRun,
  }));
  process.exit(0);
}

const matchedUserIds = [...matchedByUser.keys()];
const previousLogs = [];
for (const userGroup of chunk(matchedUserIds, IN_CHUNK_SIZE)) {
  previousLogs.push(...await readRows(() => supabase.from("notification_log")
    .select("user_id, offer_id, result")
    .in("user_id", userGroup)
    .in("offer_id", matchedOfferIds), ["user_id", "offer_id"]));
}
const alreadySent = new Set(previousLogs.filter((entry) => entry.result === "sent").map((entry) => `${entry.user_id}:${entry.offer_id}`));
const subscriptionGroups = Map.groupBy(subscriptions, (subscription) => subscription.user_id);
const expiredSubscriptionIds = new Set();
let notificationsSent = 0;
let notificationsWouldSend = 0;
let notificationsFailed = 0;

for (const [userId, userOffers] of matchedByUser) {
  const userSubscriptions = subscriptionGroups.get(userId) ?? [];
  if (userSubscriptions.length === 0) continue;
  for (const offer of userOffers.values()) {
    if (alreadySent.has(`${userId}:${offer.id}`)) continue;
    if (dryRun) {
      notificationsWouldSend += 1;
      continue;
    }
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
      sent_at: new Date().toISOString(),
      result: delivered ? "sent" : "failed",
      error_code: delivered ? null : safeErrorCode,
    }, { onConflict: "user_id,offer_id" });
    if (error) throw error;
    if (delivered) notificationsSent += 1;
    else notificationsFailed += 1;
  }
}

for (const group of chunk([...expiredSubscriptionIds], IN_CHUNK_SIZE)) {
  const { error } = await supabase.from("push_subscriptions").delete().in("id", group);
  if (error) throw error;
}
console.log(JSON.stringify({
  date: today,
  feedUpdatedAt: feed.updatedAt,
  maxSourceAgeHours: MAX_SOURCE_AGE_MS / 3_600_000,
  activeOffers: activeOffers.length,
  activeVerifiedOffers: offers.length,
  usersMatched: matchedByUser.size,
  notificationsSent,
  notificationsWouldSend,
  notificationsFailed,
  expiredSubscriptionsRemoved: expiredSubscriptionIds.size,
  dryRun,
}));
