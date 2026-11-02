import webpush from "web-push";
import { VAPID_PUBLIC_KEY } from "./domain/vapid-config.mjs";
import { offerUrl } from "./alerts/plan.mjs";

const DEFAULT_VAPID_SUBJECT = "mailto:alertas@feira-boa.pages.dev";

/** @returns {{ publicKey: string, privateKey: string, subject: string } | null} */
export function readVapidConfig(env) {
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const publicKey = (env.VAPID_PUBLIC_KEY?.trim() || VAPID_PUBLIC_KEY).trim();
  const subject = (env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT).trim();
  if (!privateKey || !publicKey) return null;
  return { publicKey, privateKey, subject };
}

export function configureVapid({ publicKey, privateKey, subject }) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function buildPushPayload({ title, body, url, tag }) {
  return JSON.stringify({ title, body, url, tag: tag ?? "feira-alert" });
}

export function buildPushPayloadForOffer({ offer, siteUrl, title, body }) {
  return buildPushPayload({
    title,
    body,
    url: offerUrl(siteUrl, offer),
    tag: offer.id,
  });
}

/** @param {import("web-push").WebPushError | Error} error */
export function pushErrorCode(error) {
  const statusCode = /** @type {{ statusCode?: number }} */ (error).statusCode;
  if (statusCode === 410 || statusCode === 404) return "push_subscription_gone";
  if (typeof statusCode === "number") return `push_http_${statusCode}`;
  return "push_api_error";
}

export function subscriptionFromRow(row) {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth_key },
  };
}

/**
 * @param {import("web-push").PushSubscription} subscription
 * @param {string} payload
 */
export async function sendWebPush(subscription, payload) {
  await webpush.sendNotification(subscription, payload);
}
