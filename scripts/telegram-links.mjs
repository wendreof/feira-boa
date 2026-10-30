// Troca tokens de vinculo (/start <token>) por chat_id em telegram_links.
// Roda a cada 15 minutos pelo workflow telegram-link-sync.yml.
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getTelegramUpdates, parseStartToken, sendTelegramMessage } from "./telegram-client.mjs";

const LINKED_TEXT = "Pronto! Seus alertas de preço agora chegam por aqui.";
const EXPIRED_TEXT = "Este link expirou ou já foi usado. Gere um novo link na página de alertas do Feira Boa.";

/**
 * Processa as atualizações pendentes do bot e confirma as que foram lidas.
 * Atualizações já tratadas são seguras de reprocessar: o token é apagado após o uso.
 */
export async function syncTelegramLinks({ supabase, token, now = new Date() }) {
  const updates = await getTelegramUpdates(token);
  const counts = { updates: updates.length, linked: 0, expired: 0 };

  for (const update of updates) {
    const message = update.message;
    const chatId = message?.chat?.id;
    const startToken = parseStartToken(message?.text);
    if (!chatId || !startToken) continue;

    try {
      const { data: row, error } = await supabase
        .from("telegram_link_tokens")
        .select("user_id, expires_at")
        .eq("token", startToken)
        .maybeSingle();
      if (error) throw error;

      if (!row || Date.parse(row.expires_at) <= now.getTime()) {
        counts.expired += 1;
        await reply(token, chatId, EXPIRED_TEXT);
        continue;
      }

      // Um chat pertence a uma conta só: libera o chat se outra conta o usava.
      const { error: releaseError } = await supabase
        .from("telegram_links")
        .delete()
        .eq("chat_id", chatId)
        .neq("user_id", row.user_id);
      if (releaseError) throw releaseError;

      const { error: linkError } = await supabase.from("telegram_links").upsert(
        { user_id: row.user_id, chat_id: chatId, linked_at: now.toISOString() },
        { onConflict: "user_id" },
      );
      if (linkError) throw linkError;

      const { error: consumeError } = await supabase.from("telegram_link_tokens").delete().eq("token", startToken);
      if (consumeError) throw consumeError;

      counts.linked += 1;
      await reply(token, chatId, LINKED_TEXT);
    } catch (error) {
      // Um erro isolado não deve impedir os outros vínculos de serem processados.
      console.error(`Telegram link failed for chat ${chatId}: ${error?.message ?? error}`);
    }
  }

  if (updates.length > 0) {
    const lastId = Math.max(...updates.map((update) => update.update_id));
    await getTelegramUpdates(token, lastId + 1);
  }
  return counts;
}

async function reply(token, chatId, text) {
  try {
    await sendTelegramMessage(token, chatId, text);
  } catch (error) {
    console.warn(`Could not reply in Telegram chat: ${error?.message ?? error}`);
  }
}

async function main() {
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TELEGRAM_BOT_TOKEN"].filter((name) => !process.env[name]);
  if (missing.length > 0) throw new Error(`Missing required environment: ${missing.join(", ")}`);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const counts = await syncTelegramLinks({ supabase, token: process.env.TELEGRAM_BOT_TOKEN });
  console.log(JSON.stringify(counts));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  });
}
