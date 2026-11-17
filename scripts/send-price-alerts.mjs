import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { MAX_SOURCE_AGE_MS, getVerifiedActiveOffers, saoPauloDate } from "./offer-matcher.mjs";
import { sendTelegramMessage, TelegramApiError } from "./telegram-client.mjs";
import {
  buildAlertMessage,
  buildTelegramDigestReplyMarkup,
  buildTelegramDigestText,
  buildTelegramReplyMarkup,
  buildTelegramText,
  matchOffersToUsers,
  partitionTelegramDelivery,
  pendingNotifications,
} from "./alerts/plan.mjs";
import {
  buildPushPayloadForOffer,
  configureVapid,
  pushErrorCode,
  readVapidConfig,
  sendWebPush,
  subscriptionFromRow,
} from "./push-client.mjs";
import { siteFaviconUrl } from "./domain/christmas-season.mjs";

const MAX_FEED_AGE_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const IN_CHUNK_SIZE = 100;
const TELEGRAM_SEND_GAP_MS = 40;
const PUSH_SEND_GAP_MS = 20;
const CHANNEL_TELEGRAM = "telegram";
const CHANNEL_PUSH = "push";
const REQUIRED_ENVIRONMENT = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TELEGRAM_BOT_TOKEN",
  "SITE_URL",
];

function readConfig(env) {
  const missing = REQUIRED_ENVIRONMENT.filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Missing required environment: ${missing.join(", ")}`);

  const siteUrl = new URL(env.SITE_URL);
  if (siteUrl.protocol !== "https:") throw new Error("SITE_URL must use HTTPS.");
  const vapid = readVapidConfig(env);
  if (vapid) configureVapid(vapid);
  return { siteUrl, telegramToken: env.TELEGRAM_BOT_TOKEN, vapid };
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function loadAlreadySent(supabase, channel, userIds, offerIds) {
  if (userIds.length === 0 || offerIds.length === 0) return new Set();
  const previousLogs = [];
  for (const userGroup of chunk(userIds, IN_CHUNK_SIZE)) {
    previousLogs.push(...await readRows(() => supabase.from("notification_log")
      .select("user_id, offer_id, result")
      .eq("channel", channel)
      .in("user_id", userGroup)
      .in("offer_id", offerIds), ["user_id", "offer_id"]));
  }
  return new Set(previousLogs.filter((entry) => entry.result === "sent").map((entry) => `${entry.user_id}:${entry.offer_id}`));
}

/** Código gravado em notification_log.error_code; nunca inclui o texto da API. */
function telegramErrorCode(error) {
  if (error instanceof TelegramApiError) {
    if (error.telegramStatus === 403) return "telegram_blocked";
    return `telegram_http_${error.telegramStatus}`;
  }
  return "telegram_api_error";
}

async function markTelegramBlocked(supabase, userId) {
  const now = new Date().toISOString();
  await supabase.from("telegram_links").update({ delivery_blocked: true, delivery_blocked_at: now }).eq("user_id", userId);
}

async function logNotification(supabase, { channel, userId, offerId, delivered, safeErrorCode, title, body }) {
  const { error } = await supabase.from("notification_log").upsert({
    user_id: userId,
    offer_id: offerId,
    channel,
    sent_at: new Date().toISOString(),
    result: delivered ? "sent" : "failed",
    error_code: delivered ? null : safeErrorCode,
    title,
    body,
  }, { onConflict: "user_id,offer_id,channel" });
  if (error) throw error;
}

async function sendOneTelegramAlert({ supabase, config, chatId, userId, offer, today, brandPreviewUrl, counts }) {
  const { title, body } = buildAlertMessage(offer);
  const text = buildTelegramText(offer, config.siteUrl, today);
  const replyMarkup = buildTelegramReplyMarkup(offer, config.siteUrl);
  let delivered = false;
  let safeErrorCode = null;
  try {
    await sendTelegramMessage(config.telegramToken, chatId, text, {
      replyMarkup,
      linkPreviewUrl: brandPreviewUrl ?? undefined,
    });
    delivered = true;
  } catch (error) {
    safeErrorCode = telegramErrorCode(error);
    console.error(`Telegram send failed for user ${userId} offer ${offer.id}: ${error.message}`);
    if (safeErrorCode === "telegram_blocked") await markTelegramBlocked(supabase, userId);
  }
  await logNotification(supabase, {
    channel: CHANNEL_TELEGRAM,
    userId,
    offerId: offer.id,
    delivered,
    safeErrorCode,
    title,
    body,
  });
  if (delivered) counts.notificationsSent += 1;
  else counts.notificationsFailed += 1;
  await sleep(TELEGRAM_SEND_GAP_MS);
}

async function sendOnePushAlert({ supabase, config, userId, offer, subscriptions, today, counts }) {
  const { title, body } = buildAlertMessage(offer);
  const payload = buildPushPayloadForOffer({ offer, siteUrl: config.siteUrl, title, body, today });
  let delivered = false;
  let safeErrorCode = null;
  for (const row of subscriptions) {
    try {
      await sendWebPush(subscriptionFromRow(row), payload);
      delivered = true;
      await supabase.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("endpoint", row.endpoint);
    } catch (error) {
      safeErrorCode = pushErrorCode(error);
      console.error(`Push send failed for user ${userId} offer ${offer.id}: ${error.message}`);
      if (safeErrorCode === "push_subscription_gone") {
        await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
      }
    }
    await sleep(PUSH_SEND_GAP_MS);
  }
  await logNotification(supabase, {
    channel: CHANNEL_PUSH,
    userId,
    offerId: offer.id,
    delivered,
    safeErrorCode: delivered ? null : safeErrorCode,
    title,
    body,
  });
  if (delivered) counts.pushSent += 1;
  else counts.pushFailed += 1;
}

async function sendAlerts({
  supabase,
  telegramPending,
  digests,
  pushPending,
  config,
  chatIdByUser,
  subscriptionsByUser,
  pausedUsers,
  blockedUsers,
  today,
  dryRun,
}) {
  const counts = {
    notificationsSent: 0,
    notificationsWouldSend: 0,
    notificationsFailed: 0,
    skippedNoChannel: 0,
    skippedPaused: 0,
    skippedBlocked: 0,
    digestsSent: 0,
    pushSent: 0,
    pushWouldSend: 0,
    pushFailed: 0,
    skippedNoPush: 0,
  };
  const brandPreviewUrl = siteFaviconUrl(config.siteUrl, { today });

  for (const { userId, offer } of telegramPending) {
    if (dryRun) {
      counts.notificationsWouldSend += 1;
      continue;
    }
    if (pausedUsers.has(userId)) {
      counts.skippedPaused += 1;
      continue;
    }
    if (blockedUsers.has(userId)) {
      counts.skippedBlocked += 1;
      continue;
    }
    const chatId = chatIdByUser.get(userId);
    if (!chatId) {
      counts.skippedNoChannel += 1;
      continue;
    }
    await sendOneTelegramAlert({ supabase, config, chatId, userId, offer, today, brandPreviewUrl, counts });
  }

  for (const { userId, offers } of digests) {
    if (dryRun) {
      counts.notificationsWouldSend += offers.length;
      continue;
    }
    if (pausedUsers.has(userId) || blockedUsers.has(userId)) continue;
    const chatId = chatIdByUser.get(userId);
    if (!chatId) continue;
    const text = buildTelegramDigestText(offers, config.siteUrl);
    const replyMarkup = buildTelegramDigestReplyMarkup(config.siteUrl);
    try {
      await sendTelegramMessage(config.telegramToken, chatId, text, {
        replyMarkup,
        linkPreviewUrl: brandPreviewUrl,
      });
      counts.digestsSent += 1;
    } catch (error) {
      const code = telegramErrorCode(error);
      console.error(`Telegram digest failed for user ${userId}: ${error.message}`);
      if (code === "telegram_blocked") await markTelegramBlocked(supabase, userId);
    }
    await sleep(TELEGRAM_SEND_GAP_MS);
  }

  if (!config.vapid) return counts;

  for (const { userId, offer } of pushPending) {
    if (dryRun) {
      counts.pushWouldSend += 1;
      continue;
    }
    if (pausedUsers.has(userId)) continue;
    const subscriptions = subscriptionsByUser.get(userId) ?? [];
    if (subscriptions.length === 0) {
      counts.skippedNoPush += 1;
      continue;
    }
    await sendOnePushAlert({ supabase, config, userId, offer, subscriptions, today, counts });
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
  const runStarted = new Date().toISOString();
  const emptySummary = {
    date: today,
    dryRun,
    notificationsSent: 0,
    notificationsWouldSend: 0,
    notificationsFailed: 0,
    skippedNoChannel: 0,
    skippedPaused: 0,
    skippedBlocked: 0,
    digestsSent: 0,
    pushSent: 0,
    pushWouldSend: 0,
    pushFailed: 0,
    skippedNoPush: 0,
    pushEnabled: Boolean(config.vapid),
  };

  const rules = await readRows(() => supabase.from("alert_rules")
    .select("id, user_id, store, product, product_type, target_price")
    .eq("enabled", true), ["id"]);
  if (rules.length === 0) {
    const summary = { ...emptySummary, activeOffers: 0, activeVerifiedOffers: 0, usersMatched: 0 };
    await supabase.from("alert_runs").insert({ started_at: runStarted, finished_at: new Date().toISOString(), status: "ok", details: summary });
    return summary;
  }

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
  const summaryBase = {
    ...emptySummary,
    feedUpdatedAt: feed.updatedAt,
    maxSourceAgeHours: MAX_SOURCE_AGE_MS / 3_600_000,
    activeOffers: activeOffers.length,
    activeVerifiedOffers: offers.length,
    usersMatched: matchedByUser.size,
  };

  const matchedOfferIds = [...new Set([...matchedByUser.values()].flatMap((matches) => [...matches.keys()]))];
  if (matchedOfferIds.length === 0) {
    await supabase.from("alert_runs").insert({ started_at: runStarted, finished_at: new Date().toISOString(), status: "ok", details: summaryBase });
    return summaryBase;
  }

  const matchedUserIds = [...matchedByUser.keys()];
  const [alreadySentTelegram, alreadySentPush] = await Promise.all([
    loadAlreadySent(supabase, CHANNEL_TELEGRAM, matchedUserIds, matchedOfferIds),
    loadAlreadySent(supabase, CHANNEL_PUSH, matchedUserIds, matchedOfferIds),
  ]);
  const telegramPendingAll = pendingNotifications(matchedByUser, alreadySentTelegram);
  const pushPendingAll = pendingNotifications(matchedByUser, alreadySentPush);
  const { immediate: telegramPending, digests } = partitionTelegramDelivery(telegramPendingAll);
  const { immediate: pushPending } = partitionTelegramDelivery(pushPendingAll);

  const pausedUsers = new Set();
  const blockedUsers = new Set();
  const chatIdByUser = new Map();
  const subscriptionsByUser = new Map();
  const needsDeliveryData = !dryRun && (telegramPending.length > 0 || digests.length > 0 || (config.vapid && pushPending.length > 0));
  if (needsDeliveryData) {
    for (const userGroup of chunk(matchedUserIds, IN_CHUNK_SIZE)) {
      const profiles = await readRows(() => supabase.from("profiles")
        .select("user_id, notifications_paused")
        .in("user_id", userGroup), ["user_id"]);
      for (const profile of profiles) {
        if (profile.notifications_paused) pausedUsers.add(profile.user_id);
      }
      if (telegramPending.length > 0 || digests.length > 0) {
        const links = await readRows(() => supabase.from("telegram_links")
          .select("user_id, chat_id, delivery_blocked")
          .in("user_id", userGroup), ["user_id"]);
        for (const link of links) {
          chatIdByUser.set(link.user_id, Number(link.chat_id));
          if (link.delivery_blocked) blockedUsers.add(link.user_id);
        }
      }
      if (config.vapid && pushPending.length > 0) {
        const subs = await readRows(() => supabase.from("push_subscriptions")
          .select("user_id, endpoint, p256dh, auth_key")
          .in("user_id", userGroup), ["endpoint"]);
        for (const row of subs) {
          const list = subscriptionsByUser.get(row.user_id) ?? [];
          list.push(row);
          subscriptionsByUser.set(row.user_id, list);
        }
      }
    }
  }

  let counts;
  let status = "ok";
  try {
    counts = await sendAlerts({
      supabase,
      telegramPending,
      digests,
      pushPending,
      config,
      chatIdByUser,
      subscriptionsByUser,
      pausedUsers,
      blockedUsers,
      today,
      dryRun,
    });
  } catch (error) {
    status = "failed";
    await supabase.from("alert_runs").insert({
      started_at: runStarted,
      finished_at: new Date().toISOString(),
      status,
      details: { error: error?.message ?? String(error) },
    });
    throw error;
  }

  const summary = { ...summaryBase, ...counts };
  const anyFailed = summary.notificationsFailed > 0 || summary.pushFailed > 0;
  const anySent = summary.notificationsSent > 0 || summary.pushSent > 0;
  if (anyFailed && anySent) status = "partial";
  else if (anyFailed && !anySent) status = "failed";
  await supabase.from("alert_runs").insert({
    started_at: runStarted,
    finished_at: new Date().toISOString(),
    status,
    details: summary,
  });
  return summary;
}

main()
  .then((summary) => console.log(JSON.stringify(summary)))
  .catch((error) => {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  });
