/** @typedef {{ today?: string, queryOverride?: boolean | null, storageOverride?: boolean | null, now?: Date }} ChristmasSeasonOptions */

const SAO_PAULO_TZ = "America/Sao_Paulo";

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
 * @param {ChristmasSeasonOptions} [options]
 * @returns {boolean}
 */
export function resolveChristmasSeasonEnabled(options = {}) {
  const { today, queryOverride = null, storageOverride = null, now = new Date() } = options;
  if (queryOverride === true || storageOverride === true) return true;
  if (queryOverride === false || storageOverride === false) return false;
  const resolvedToday = today ?? todayIsoInTimeZone(SAO_PAULO_TZ, now);
  return isChristmasSeasonDate(resolvedToday);
}