/** @typedef {{ today?: string, queryOverride?: boolean | null, storageOverride?: boolean | null, now?: Date }} ChristmasSeasonOptions */

const SAO_PAULO_TZ = "America/Sao_Paulo";

export const FAVICON_DEFAULT = "favicon.svg";
export const FAVICON_CHRISTMAS = "favicon-christmas.svg";

export const PUSH_NOTIFICATION_ICON_DEFAULT = "icons/notification-96.png";
export const PUSH_NOTIFICATION_ICON_CHRISTMAS = "icons/notification-christmas-96.png";
export const PUSH_NOTIFICATION_BADGE_DEFAULT = "icons/badge-72.png";
export const PUSH_NOTIFICATION_BADGE_CHRISTMAS = "icons/badge-christmas-72.png";

export const MANIFEST_DEFAULT = "manifest.webmanifest";
export const MANIFEST_CHRISTMAS = "manifest-christmas.webmanifest";

export const PWA_ICON_QUERY = "?v=20261117";
export const PWA_ICON_192_DEFAULT = "icons/icon-192.png";
export const PWA_ICON_192_CHRISTMAS = "icons/icon-christmas-192.png";
export const PWA_ICON_512_DEFAULT = "icons/icon-512.png";
export const PWA_ICON_512_CHRISTMAS = "icons/icon-christmas-512.png";
export const PWA_MASKABLE_512_DEFAULT = "icons/maskable-512.png";
export const PWA_MASKABLE_512_CHRISTMAS = "icons/maskable-christmas-512.png";

/**
 * @param {string} [timeZone]
 * @param {Date} [now]
 * @returns {string}
 */
export function todayIsoInTimeZone(timeZone = SAO_PAULO_TZ, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${part.year}-${part.month}-${part.day}`;
}

/**
 * Natal: 1 dez – 6 jan (inclusive), calendário local.
 * @param {string} isoDate AAAA-MM-DD
 */
export function isChristmasSeasonDate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  if (month === 12 && day >= 1) return true;
  if (month === 1 && day <= 6) return true;
  return false;
}

/**
 * @param {{ get?: (key: string) => string | null } | null | undefined} searchParams
 * @returns {boolean | null}
 */
export function parseChristmasSeasonQuery(searchParams) {
  if (!searchParams || typeof searchParams.get !== "function") return null;
  const raw = (searchParams.get("christmas") ?? "").trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return null;
}

/**
 * Default: on 1 Dec–6 Jan (São Paulo calendar). Preview via ?christmas=1 or localStorage; opt out via ?christmas=0.
 * @param {ChristmasSeasonOptions} [options]
 * @returns {boolean}
 */
export function resolveChristmasSeasonEnabled(options = {}) {
  const { queryOverride = null, storageOverride = null, today, now = new Date() } = options;
  if (queryOverride === true || storageOverride === true) return true;
  if (queryOverride === false || storageOverride === false) return false;
  const resolvedToday = today ?? todayIsoInTimeZone(SAO_PAULO_TZ, now);
  return isChristmasSeasonDate(resolvedToday);
}

/**
 * Server-side (push/Telegram): same rules as the site theme, without browser overrides.
 * @param {{ today?: string, now?: Date, christmas?: boolean } & ChristmasSeasonOptions} [options]
 */
export function resolveChristmasSeasonForNotifications(options = {}) {
  const { today, now = new Date(), christmas = undefined } = options;
  if (typeof christmas === "boolean") return christmas;
  const resolvedToday = today ?? todayIsoInTimeZone(SAO_PAULO_TZ, now);
  return resolveChristmasSeasonEnabled({ ...options, today: resolvedToday, now });
}

/**
 * Root-relative favicon path for the active season.
 * @param {Parameters<typeof resolveChristmasSeasonForNotifications>[0]} [options]
 */
export function siteFaviconPath(options = {}) {
  const file = resolveChristmasSeasonForNotifications(options) ? FAVICON_CHRISTMAS : FAVICON_DEFAULT;
  return `/${file}`;
}

/**
 * Absolute favicon URL for outbound notifications and link previews.
 * @param {string | URL} siteUrl
 * @param {Parameters<typeof resolveChristmasSeasonForNotifications>[0]} [options]
 */
export function siteFaviconUrl(siteUrl, options = {}) {
  const base = typeof siteUrl === "string" ? new URL(siteUrl) : siteUrl;
  return new URL(siteFaviconPath(options), base).href;
}

/**
 * @param {string | URL} siteUrl
 * @param {Parameters<typeof resolveChristmasSeasonForNotifications>[0]} [options]
 * @returns {{ icon: string, badge: string }}
 */
export function sitePushNotificationAssets(siteUrl, options = {}) {
  const base = typeof siteUrl === "string" ? new URL(siteUrl) : siteUrl;
  const christmas = resolveChristmasSeasonForNotifications(options);
  const iconPath = christmas ? PUSH_NOTIFICATION_ICON_CHRISTMAS : PUSH_NOTIFICATION_ICON_DEFAULT;
  const badgePath = christmas ? PUSH_NOTIFICATION_BADGE_CHRISTMAS : PUSH_NOTIFICATION_BADGE_DEFAULT;
  return {
    icon: new URL(iconPath, base).href,
    badge: new URL(badgePath, base).href,
  };
}

/**
 * Web app manifest link href for the active season.
 * @param {Parameters<typeof resolveChristmasSeasonForNotifications>[0]} [options]
 */
export function siteManifestHref(options = {}) {
  return resolveChristmasSeasonForNotifications(options) ? MANIFEST_CHRISTMAS : MANIFEST_DEFAULT;
}

/**
 * Apple touch / home-screen icon href (relative, includes cache query).
 * @param {Parameters<typeof resolveChristmasSeasonForNotifications>[0]} [options]
 */
export function siteAppleTouchIconHref(options = {}) {
  const icon = resolveChristmasSeasonForNotifications(options) ? PWA_ICON_192_CHRISTMAS : PWA_ICON_192_DEFAULT;
  return `${icon}${PWA_ICON_QUERY}`;
}