// Cliente minimo da Bot API do Telegram. O token do bot fica so no ambiente do job
// (secret do GitHub Actions); nunca vai para o navegador.
export const TELEGRAM_API_URL = "https://api.telegram.org";
const TIMEOUT_MS = 15_000;

/** Erro de chamada à API, com o status HTTP para mapear códigos de falha. */
export class TelegramApiError extends Error {
  constructor(method, status, description) {
    super(`Telegram ${method} failed: HTTP ${status}${description ? ` (${description})` : ""}`);
    this.name = "TelegramApiError";
    this.telegramStatus = status;
  }
}

export async function telegramCall(token, method, params = {}) {
  const response = await fetch(`${TELEGRAM_API_URL}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new TelegramApiError(method, response.status, data?.description ?? "");
  }
  return data.result;
}

/** Envia texto simples (sem parse_mode, para não quebrar com nomes de produto). */
export function sendTelegramMessage(token, chatId, text, options = {}) {
  const { replyMarkup, linkPreview = false } = options;
  const params = {
    chat_id: chatId,
    text,
    disable_web_page_preview: !linkPreview,
  };
  if (replyMarkup) params.reply_markup = replyMarkup;
  return telegramCall(token, "sendMessage", params);
}

export function setTelegramWebhook(token, url, secretToken) {
  return telegramCall(token, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
}

export function deleteTelegramWebhook(token) {
  return telegramCall(token, "deleteWebhook", { drop_pending_updates: false });
}

export function setTelegramCommands(token, commands) {
  return telegramCall(token, "setMyCommands", { commands });
}

/** Lê atualizações pendentes. Passe `offset = último update_id + 1` para confirmá-las. */
export function getTelegramUpdates(token, offset) {
  const params = { timeout: 0, limit: 100, allowed_updates: ["message"] };
  if (offset !== undefined) params.offset = offset;
  return telegramCall(token, "getUpdates", params);
}

/** Extrai o token de `/start <token>` (ou `/start@bot <token>`). Retorna null se não houver. */
export function parseStartToken(text) {
  const match = /^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{16,64})\s*$/.exec(String(text ?? "").trim());
  return match ? match[1] : null;
}
