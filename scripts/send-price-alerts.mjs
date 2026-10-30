import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { MAX_SOURCE_AGE_MS, getVerifiedActiveOffers, saoPauloDate } from "./offer-matcher.mjs";
import { sendNotification } from "./onesignal-client.mjs";
import {
  buildAlertMessage,
  matchOffersToUsers,
  offerUrl,
  pendingNotifications,
} from "./alerts/plan.mjs";

const MAX_FEED_AGE_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const IN_CHUNK_SIZE = 100;
const REQUIRED_ENVIRONMENT = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ONESIGNAL_APP_ID",
  "ONESIGNAL_REST_API_KEY",
  "SITE_URL",
];

function readConfig(env) {
  const missing = REQUIRED_ENVIRONMENT.filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Missing required environment: ${missing.join(", ")}`);

  const siteUrl = new URL(env.SITE_URL);
  if (siteUrl.protocol !== "https:") throw new Error("SITE_URL must use HTTPS.");
  return { siteUrl, oneSignalAppId: env.ONESIGNAL_APP_ID, oneSignalApiKey: env.ONESIGNAL_REST_API_KEY };
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

/** Lê todas as páginas de uma consulta. `queryFactory` devolve uma consulta nova a cada chamada. */
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

async function loadFeed() {
  const [feedText, sourceStateText] = await Promise.all([
    readFile(new URL("../offers.json", import.meta.url), "utf8"),
    readFile(new URL("../.offer-monitor-state.json", import.meta.url), "utf8"),
  ]);
  const feed = JSON.parse(feedText);
  const feedUpdatedAt = Date.parse(feed.updatedAt);
  if (!Number.isFinite(feedUpdatedAt)) throw new Error("offers.json has no valid updatedAt timestamp.");
  return { feed, feedUpdatedAt, sourceState: JSON.parse(sourceStateText) };
}

async function sendAlerts({ supabase, pending, config, dryRun }) {
  const counts = { notificationsSent: 0, notificationsWouldSend: 0, notificationsFailed: 0, skippedNoDevice: 0 };
  for (const { userId, offer } of pending) {
    if (dryRun) {
      counts.notificationsWouldSend += 1;
      continue;
    }
    const { title, body } = buildAlertMessage(offer);
    let delivered = false;
    let safeErrorCode = null;
    try {
      const recipients = await sendNotification({
        appId: config.oneSignalAppId,
        apiKey: config.oneSignalApiKey,
        userId,
        title,
        body,
        url: offerUrl(config.siteUrl, offer),
        collapseId: `feira-${offer.id}`,
      });
      if (recipients === 0) {
        counts.skippedNoDevice += 1;
        continue;
      }
      delivered = true;
    } catch (error) {
      const status = Number(error?.onesignalStatus);
      safeErrorCode = status ? `onesignal_http_${status}` : "onesignal_api_error";
      console.error(`OneSignal send failed for user ${userId} offer ${offer.id}: ${error.message}`);
    }
    // Guarda o texto exato enviado para a página de mensagens.
    const { error } = await supabase.from("notification_log").upsert({
      user_id: userId,
      offer_id: offer.id,
      sent_at: new Date().toISOString(),
      result: delivered ? "sent" : "failed",
      error_code: delivered ? null : safeErrorCode,
      title,
      body,
    }, { onConflict: "user_id,offer_id" });
    if (error) throw error;
    if (delivered) counts.notificationsSent += 1;
    else counts.notificationsFailed += 1;
  }
  return counts;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const config = readConfig(process.env);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const today = saoPauloDate();
  const emptySummary = { date: today, dryRun, notificationsSent: 0, notificationsWouldSend: 0, notificationsFailed: 0, skippedNoDevice: 0 };

  const rules = await readRows(() => supabase.from("alert_rules")
    .select("id, user_id, store, product, product_type, target_price")
    .eq("enabled", true), ["id"]);
  if (rules.length === 0) return { ...emptySummary, activeOffers: 0, activeVerifiedOffers: 0, usersMatched: 0 };

  const { feed, feedUpdatedAt, sourceState } = await loadFeed();
  if (Date.now() - feedUpdatedAt > MAX_FEED_AGE_MS) {
    throw new Error(`Offer feed is older than 24 hours (updatedAt=${feed.updatedAt}).`);
  }

  const activeOffers = feed.offers.filter((offer) => offer.validFrom <= today && offer.validTo >= today);
  const offers = getVerifiedActiveOffers(feed.offers, sourceState, today);
  if (activeOffers.length > 0 && offers.length === 0) {
    throw new Error("No verified active offers. Review changed sources and clear needs_review before sending alerts.");
  }

  const matchedByUser = matchOffersToUsers({ rules, offers });
  const summaryBase = { ...emptySummary, feedUpdatedAt: feed.updatedAt, maxSourceAgeHours: MAX_SOURCE_AGE_MS / 3_600_000, activeOffers: activeOffers.length, activeVerifiedOffers: offers.length, usersMatched: matchedByUser.size };

  const matchedOfferIds = [...new Set([...matchedByUser.values()].flatMap((matches) => [...matches.keys()]))];
  if (matchedOfferIds.length === 0) return summaryBase;

  const matchedUserIds = [...matchedByUser.keys()];
  const previousLogs = [];
  for (const userGroup of chunk(matchedUserIds, IN_CHUNK_SIZE)) {
    previousLogs.push(...await readRows(() => supabase.from("notification_log")
      .select("user_id, offer_id, result")
      .in("user_id", userGroup)
      .in("offer_id", matchedOfferIds), ["user_id", "offer_id"]));
  }
  const alreadySent = new Set(previousLogs.filter((entry) => entry.result === "sent").map((entry) => `${entry.user_id}:${entry.offer_id}`));
  const pending = pendingNotifications(matchedByUser, alreadySent);

  const counts = await sendAlerts({ supabase, pending, config, dryRun });
  return { ...summaryBase, ...counts };
}

main()
  .then((summary) => console.log(JSON.stringify(summary)))
  .catch((error) => {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  });
