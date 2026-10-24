export const ONESIGNAL_NOTIFICATIONS_URL = "https://api.onesignal.com/notifications";

/**
 * Monta a requisição de envio push para um usuário identificado pelo
 * `external_id` (= Supabase user id). A API atual exige o App API key
 * (prefixo `os_v2_app_`) no header `Authorization: Key <chave>`.
 */
export function buildNotificationRequest({ appId, apiKey, userId, title, body, url, collapseId, ttlSeconds = 60 * 60 * 24 }) {
  return {
    url: ONESIGNAL_NOTIFICATIONS_URL,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: "push",
        include_aliases: { external_id: [userId] },
        headings: { en: title, pt: title },
        contents: { en: body, pt: body },
        url,
        data: { url },
        collapse_id: collapseId,
        ttl: ttlSeconds,
      }),
    },
  };
}

const NO_SUBSCRIBED_DEVICES = /not subscribed|no players|no recipients/i;

/**
 * Envia a notificação e devolve o número de destinatários. Retorna 0 quando o
 * usuário não tem dispositivo inscrito (não é falha). Lança erro com
 * `onesignalStatus` nas respostas HTTP de erro.
 */
export async function sendNotification(options, fetchImpl = fetch) {
  const request = buildNotificationRequest(options);
  const response = await fetchImpl(request.url, request.init);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = Array.isArray(data?.errors) ? data.errors.join("; ") : JSON.stringify(data);
    const error = new Error(`OneSignal HTTP ${response.status}: ${detail}`);
    error.onesignalStatus = response.status;
    throw error;
  }
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    const text = data.errors.join("; ");
    if (NO_SUBSCRIBED_DEVICES.test(text)) return 0;
    throw new Error(`OneSignal API error: ${text}`);
  }
  return Number(data?.recipients ?? 0);
}
