import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { buildTelegramBotCopy, processTelegramUpdate } from "../_shared/telegram-updates.mjs";

const TELEGRAM_API = "https://api.telegram.org";

async function sendTelegramMessage(token: string, chatId: number, text: string): Promise<void> {
  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description ?? `HTTP ${response.status}`);
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!expectedSecret || secret !== expectedSecret) {
    return new Response("Forbidden", { status: 403 });
  }

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const siteUrlRaw = Deno.env.get("SITE_URL");
  const botUsername = Deno.env.get("TELEGRAM_BOT_USERNAME") ?? "";
  if (!token || !supabaseUrl || !serviceRoleKey || !siteUrlRaw) {
    return Response.json({ error: "Telegram webhook is not configured" }, { status: 500 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const siteUrl = new URL(siteUrlRaw);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const copy = buildTelegramBotCopy(siteUrl, botUsername);

  await processTelegramUpdate(update, {
    supabase,
    token,
    sendMessage: sendTelegramMessage,
    copy,
  });

  return Response.json({ ok: true });
});
