// @ts-nocheck
import { foldText } from "../../src/shared/text.mjs";
import { defaultSpassoValidityWindow } from "./spasso-flyer.mjs";

const PT_WEEKDAY = [
  { re: /\bdomingo\b/, dow: 0 },
  { re: /\bsegunda(?:\s*feira)?\b/, dow: 1 },
  { re: /\bter[cç]a(?:\s*feira)?\b/, dow: 2 },
  { re: /\bquarta(?:\s*feira)?\b/, dow: 3 },
  { re: /\bquinta(?:\s*feira)?\b/, dow: 4 },
  { re: /\bsexta(?:\s*feira)?\b/, dow: 5 },
  { re: /\bs[aá]bado\b/, dow: 6 },
];

export { formatWeekdaySpotLabel } from "./weekday-spot-label.mjs";

/** @param {string} isoDate YYYY-MM-DD */
function utcDayOfWeek(isoDate) {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

/** @param {string} isoDate */
export function mondayOfWeekContaining(isoDate) {
  const dow = utcDayOfWeek(isoDate);
  const offset = dow === 0 ? -6 : 1 - dow;
  const [year, month, day] = isoDate.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12));
  anchor.setUTCDate(anchor.getUTCDate() + offset);
  return anchor.toISOString().slice(0, 10);
}

/** Rolling encarte window: Monday through Saturday of the current Spasso week. */
export function spassoEncarteWindow(now = new Date()) {
  const { to } = defaultSpassoValidityWindow(now);
  const spToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return { from: mondayOfWeekContaining(spToday), to };
}

/** @param {string} url */
export function parseSpassoFlyerFilenameDates(url) {
  const file = url.split("/").pop() ?? "";
  const match = file.match(/(\d{1,2})-A-(\d{1,2})-(\d{1,2})-(\d{4})/i);
  if (!match) return null;
  const [, d1, d2, month, year] = match;
  const pad = (value) => String(value).padStart(2, "0");
  return {
    from: `${year}-${pad(month)}-${pad(d1)}`,
    to: `${year}-${pad(month)}-${pad(d2)}`,
  };
}

/** @param {string} url */
export function inferSpassoWeekdaysFromFlyerUrl(url) {
  const file = (url.split("/").pop() ?? "").toLowerCase();
  if (file.includes("flv")) return [2, 3];
  if (file.includes("acougue") || file.includes("acogue")) return [3, 4, 5];
  return null;
}

/** @param {string | undefined} category */
export function inferSpassoWeekdaysFromCategory(category) {
  const text = foldText(category ?? "");
  if (!text) return null;
  if (text.includes("hortifruti") || text.includes("flv")) return [2, 3];
  if (
    text.includes("carne") ||
    text.includes("acougue") ||
    text.includes("acogue") ||
    text.includes("peixe") ||
    text.includes("frio")
  ) {
    return [3, 4, 5];
  }
  return null;
}

/** @param {string} text */
export function parseWeekdaysFromPortugueseText(text) {
  if (!text || typeof text !== "string") return null;
  const folded = foldText(text);
  const rangeMatch = folded.match(
    /\b(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)\b\s+(?:a|ate|até|e)\s+\b(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)\b/i,
  );
  if (rangeMatch) {
  const start = ptWeekdayTokenToDow(rangeMatch[1]);
  const end = ptWeekdayTokenToDow(rangeMatch[2]);
    if (start !== null && end !== null) return inclusiveWeekdayRange(start, end);
  }
  const found = new Set();
  for (const { re, dow } of PT_WEEKDAY) {
    if (re.test(folded)) found.add(dow);
  }
  if (found.size === 0) return null;
  return [...found].sort((a, b) => a - b);
}

function ptWeekdayTokenToDow(token) {
  const folded = foldText(token);
  for (const { re, dow } of PT_WEEKDAY) {
    if (re.test(folded)) return dow;
  }
  return null;
}

function inclusiveWeekdayRange(start, end) {
  if (start <= end) {
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
  return [...Array.from({ length: 7 - start }, (_, index) => start + index), ...Array.from({ length: end + 1 }, (_, index) => index)];
}

/** @param {string} from @param {string} to */
export function weekdaysBetweenCalendarDates(from, to) {
  if (!from || !to || from > to) return null;
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const start = Date.UTC(y1, m1 - 1, d1, 12);
  const end = Date.UTC(y2, m2 - 1, d2, 12);
  const spanDays = Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
  if (spanDays > 7) return null;
  const set = new Set();
  for (let offset = 0; offset < spanDays; offset += 1) {
    const cursor = new Date(start + offset * 24 * 60 * 60 * 1000);
    set.add(cursor.getUTCDay());
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * @param {{ from?: string, to?: string, weekdays?: string[], label?: string, offers?: { cat?: string }[] }} campaign
 * @param {string[]} flyerImageUrls
 */
export function resolveSpassoCampaignWeekdays(campaign, flyerImageUrls) {
  const fromLabels = campaign.weekdays?.length
    ? campaign.weekdays.flatMap((day) => parseWeekdaysFromPortugueseText(day) ?? [])
    : [];
  if (fromLabels.length > 0) {
    return [...new Set(fromLabels)].sort((a, b) => a - b);
  }

  const textDays = parseWeekdaysFromPortugueseText(campaign.label ?? "");
  if (textDays?.length) return textDays;

  const rangeDays = weekdaysBetweenCalendarDates(campaign.from, campaign.to);
  if (rangeDays?.length && rangeDays.length >= 4) return rangeDays;

  const filenameDays = flyerImageUrls
    .map((url) => inferSpassoWeekdaysFromFlyerUrl(url))
    .filter(Boolean);
  const counts = new Map();
  for (const item of campaign.offers ?? []) {
    const days = inferSpassoWeekdaysFromCategory(item.cat);
    if (!days) continue;
    const key = days.join(",");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let bestCatDays = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestCatDays = key.split(",").map(Number);
    }
  }
  if (bestCatDays?.length) return bestCatDays;

  if (rangeDays?.length) return rangeDays;

  if (filenameDays.length === 1) return filenameDays[0];

  return null;
}

/**
 * @param {{ from?: string, to?: string, weekdays?: string[], label?: string, offers?: { cat?: string }[] }} campaign
 * @param {string[]} flyerImageUrls
 * @param {Date} [now]
 */
export function spassoCampaignOfferValidity(campaign, flyerImageUrls, now = new Date()) {
  const window = spassoEncarteWindow(now);
  const validWeekdays = resolveSpassoCampaignWeekdays(campaign, flyerImageUrls);
  return {
    from: window.from,
    to: window.to,
    validWeekdays,
  };
}

/** @param {string} name */
export function isSpassoSectionBannerName(name) {
  if (!name || typeof name !== "string") return true;
  const folded = foldText(name);
  if (!/\d/.test(name) && parseWeekdaysFromPortugueseText(folded)?.length >= 1 && folded.length < 80) {
    if (/(hortifruti|acougue|acogue|encarte|frios|açougue)/i.test(name)) return true;
    if (/^(ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|segunda)\b/i.test(folded.trim())) return true;
  }
  return false;
}