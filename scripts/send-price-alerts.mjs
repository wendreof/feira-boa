import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { MAX_SOURCE_AGE_MS, getVerifiedActiveOffers, saoPauloDate } from "./offer-matcher.mjs";
import { sendTelegramMessage, TelegramApiError } from "./telegram-client.mjs";
import {
  buildAlertMessage,
  matchOffersToUsers,
  offerUrl,
  pendingNotifications,
} from "./alerts/plan.mjs";

const MAX_FEED_AGE_MS = 24 * 60 * 60 * 1000;
const ALERT_DISCLAIMER = "Aviso: o preço vem do folheto publicado pela loja e pode ter mudado ou estar incorreto. Confirme na loja antes de comprar.";
const PAGE_SIZE = 1000;
const IN_CHUNK_SIZE = 100;
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
  return { siteUrl, telegramToken: env.TELEGRAM_BOT_TOKEN };
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

/** Código gravado em notification_log.error_code; nunca inclui o texto da API. */
function telegramErrorCode(error) {
  if (error instanceof TelegramApiError) {
    if (error.telegramStatus === 403) return "telegram_blocked";
    return `telegram_http_${error.telegramStatus}`;
  }
  return "telegram_api_error";
}

async function sendAlerts({ supabase, pending, config, chatIdByUser, dryRun }) {
  const counts = { notificationsSent: 0, notificationsWouldSend: 0, notificationsFailed: 0, skippedNoChannel: 0 };
  for (const { userId, offer } of pending) {
    if (dryRun) {
      counts.notificationsWouldSend += 1;
      continue;
    }
    const chatId = chatIdByUser.get(userId);
    // Sem vínculo de Telegram não há canal: não grava histórico, tenta de novo no próximo job.
    if (!chatId) {
      counts.skippedNoChannel += 1;
      continue;
    }
    const { title, body } = buildAlertMessage(offer);
    const icon = offer.icon ? `${offer.icon} ` : "";
    const text = `${icon}${title}\n${body}\n${offerUrl(config.siteUrl, offer)}\n\n${ALERT_DISCLAIMER}\n\nFeira Boa · Economia que faz bem`;
    let delivered = false;
    let safeErrorCode = null;
    try {
      await sendTelegramMessage(config.telegramToken, chatId, text);
      delivered = true;
    } catch (error) {
      safeErrorCode = telegramErrorCode(error);
      console.error(`Telegram send failed for user ${userId} offer ${offer.id}: ${error.message}`);
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
  const emptySummary = { date: today, dryRun, notificationsSent: 0, notificationsWouldSend: 0, notificationsFailed: 0, skippedNoChannel: 0 };

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

  const chatIdByUser = new Map();
  if (!dryRun && pending.length > 0) {
    for (const userGroup of chunk(matchedUserIds, IN_CHUNK_SIZE)) {
      const links = await readRows(() => supabase.from("telegram_links")
        .select("user_id, chat_id")
        .in("user_id", userGroup), ["user_id"]);
      for (const link of links) chatIdByUser.set(link.user_id, Number(link.chat_id));
    }
  }

  const counts = await sendAlerts({ supabase, pending, config, chatIdByUser, dryRun });
  return { ...summaryBase, ...counts };
}

main()
  .then((summary) => console.log(JSON.stringify(summary)))
  .catch((error) => {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  });
