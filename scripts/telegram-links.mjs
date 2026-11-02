// Troca tokens de vinculo (/start <token>) por chat_id em telegram_links.
// Backup quando o webhook não está ativo (telegram-link-sync.yml).
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { buildTelegramBotCopy, processTelegramUpdates } from "./domain/telegram-updates.mjs";
import { getTelegramUpdates, sendTelegramMessage, TelegramApiError } from "./telegram-client.mjs";

const EMPTY_COUNTS = { updates: 0, linked: 0, expired: 0, help: 0, command: 0, ignored: 0 };

export async function syncTelegramLinks({ supabase, token, siteUrl, botUsername, now = new Date() }) {
  let updates;
  try {
    updates = await getTelegramUpdates(token);
  } catch (error) {
    if (error instanceof TelegramApiError && error.telegramStatus === 409) {
      return { ...EMPTY_COUNTS, mode: "webhook_active" };
    }
    throw error;
  }
  const copy = buildTelegramBotCopy(siteUrl, botUsername);
  const counts = await processTelegramUpdates(updates, {
    supabase,
    token,
    now,
    sendMessage: sendTelegramMessage,
    copy,
  });

  if (updates.length > 0) {
    const lastId = Math.max(...updates.map((update) => update.update_id));
    await getTelegramUpdates(token, lastId + 1);
  }
  return counts;
}

async function main() {
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TELEGRAM_BOT_TOKEN", "SITE_URL"].filter((name) => !process.env[name]);
  if (missing.length > 0) throw new Error(`Missing required environment: ${missing.join(", ")}`);
  const siteUrl = new URL(process.env.SITE_URL);
  if (siteUrl.protocol !== "https:") throw new Error("SITE_URL must use HTTPS.");
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const counts = await syncTelegramLinks({
    supabase,
    token: process.env.TELEGRAM_BOT_TOKEN,
    siteUrl,
    botUsername: process.env.TELEGRAM_BOT_USERNAME ?? "",
  });
  if (counts.mode === "webhook_active") {
    console.log("Webhook ativo no Telegram; getUpdates ignorado (backup desnecessário).");
  }
  console.log(JSON.stringify(counts));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  });
}
