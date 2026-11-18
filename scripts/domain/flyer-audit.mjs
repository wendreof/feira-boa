// @ts-nocheck
import { mergeBrandIntoName } from "./brands.mjs";
import { comparableText } from "../../src/shared/text.mjs";

/** @param {string} value */
function fold(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {{ name?: string, brand?: string, detail?: string }} offer
 */
export function offerAuditKey(offer) {
  const name = fold(offer.name);
  const brand = fold(offer.brand);
  const detail = fold(offer.detail);
  return `${brand ? `${brand} ` : ""}${name}|${detail}`;
}

const VISION_DETAIL_ALIASES = new Map([
  ["bdj", "bandeja"],
  ["cada", "un"],
  ["unidade", "un"],
]);

/**
 * @param {string | undefined} detail
 */
export function normalizeVisionDetail(detail) {
  let text = comparableText(detail);
  text = text.replace(/(\d+)([a-z]+)/g, "$1 $2");
  const tokens = text.split(/\s+/).filter(Boolean).map((token) => VISION_DETAIL_ALIASES.get(token) ?? token);
  const drop = new Set([
    "tipo",
    "1",
    "tp",
    "pg80",
    "cilindro",
    "frutas",
    "ou",
    "gotas",
    "temperada",
    "trad",
    "extra",
    "fina",
    "com",
    "ou",
    "15un",
    "30un",
  ]);
  return tokens.filter((token) => !drop.has(token)).join(" ");
}

/**
 * @param {{ name?: string, brand?: string }} offer
 */
function comparableVisionName(offer) {
  let name = comparableText(mergeBrandIntoName(offer.name, offer.brand));
  name = name
    .replace(/\bcabothia\b/g, "cabotia")
    .replace(/\bgomina\b/g, "goma")
    .replace(/\bcong\b/g, "congelada")
    .replace(/\bflex\b/g, "flexiveis")
    .replace(/\bcom\b/g, " ")
    .replace(/\bcaro[cç]o\b/g, " ")
    .replace(/\btrad\b/g, " ")
    .replace(/\btemperada\b/g, " ")
    .replace(/\bextra\b/g, " ")
    .replace(/\bfina\b/g, " ")
    .replace(/\btipo\s+1\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name;
}

/**
 * @param {{ name?: string, brand?: string, detail?: string }} offer
 */
export function visionAuditKey(offer) {
  let nameOffer = offer;
  const rawDetail = String(offer.detail ?? "").trim();
  const flavorText = rawDetail.replace(/^[\d.,]+\s*[a-z]+\s*/i, "").trim();
  if (flavorText) {
    nameOffer = { ...offer, name: `${offer.name ?? ""} ${flavorText}`.trim() };
  }
  const detail = normalizeVisionDetail(offer.detail);
  return `${comparableVisionName(nameOffer)}|${detail}`;
}

/**
 * @param {{ name?: string, brand?: string }} offer
 */
function visionNameTokens(offer) {
  return new Set(comparableVisionName(offer).split(/\s+/).filter(Boolean));
}

/**
 * @param {{ name?: string, brand?: string, detail?: string }} expected
 * @param {{ name?: string, brand?: string, detail?: string }} actual
 */
function visionNamesAlign(expected, actual) {
  const left = visionNameTokens(expected);
  const right = visionNameTokens(actual);
  if (left.size === 0 || right.size === 0) return false;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  const union = new Set([...left, ...right]).size;
  if (overlap / union >= 0.55) return true;
  const leftText = [...left].join(" ");
  const rightText = [...right].join(" ");
  if (leftText.includes(rightText) || rightText.includes(leftText)) return true;
  for (const lt of left) {
    for (const rt of right) {
      if (lt === rt) continue;
      if (lt.length < 3 || rt.length < 3) continue;
      const longer = lt.length >= rt.length ? lt : rt;
      const shorter = lt.length < rt.length ? lt : rt;
      if (longer.startsWith(shorter) && longer.length - shorter.length <= 3) return true;
    }
  }
  return false;
}

/**
 * @param {AuditOffer} expected
 * @param {AuditOffer} actual
 * @param {number} priceEpsilon
 */
const PACK_UNIT_COUNTS = [2, 3, 4, 5, 6, 8, 10, 12];

/**
 * @param {number} expectedPrice
 * @param {number} actualPrice
 * @param {number} priceEpsilon
 */
function visionPriceDelta(expectedPrice, actualPrice, priceEpsilon) {
  const delta = Math.abs(expectedPrice - actualPrice);
  if (delta <= priceEpsilon) return 0;
  for (const units of PACK_UNIT_COUNTS) {
    if (Math.abs(expectedPrice * units - actualPrice) <= priceEpsilon) return 0;
    if (Math.abs(actualPrice * units - expectedPrice) <= priceEpsilon) return 0;
  }
  return delta;
}

function visionOffersAlign(expected, actual, priceEpsilon) {
  if (visionPriceDelta(Number(expected.price), Number(actual.price), priceEpsilon) > priceEpsilon) return false;
  if (visionAuditKey(expected) === visionAuditKey(actual)) return true;
  return visionNamesAlign(expected, actual);
}

/**
 * @param {AuditOffer} expected
 * @param {AuditOffer} actual
 */
function scoreVisionMatch(expected, actual) {
  if (visionAuditKey(expected) === visionAuditKey(actual)) return 100;
  const left = visionNameTokens(expected);
  const right = visionNameTokens(actual);
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap;
}

/**
 * @param {AuditOffer} expected
 * @param {AuditOffer[]} remaining
 * @param {number} priceEpsilon
 */
function findBestVisionMatchIndex(expected, remaining, priceEpsilon) {
  let bestIndex = -1;
  let bestScore = -1;
  for (let index = 0; index < remaining.length; index += 1) {
    const candidate = remaining[index];
    if (!visionOffersAlign(expected, candidate, priceEpsilon)) continue;
    const score = scoreVisionMatch(expected, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

/**
 * @typedef {{ name?: string, brand?: string, detail?: string, price?: number }} AuditOffer
 * @typedef {{ campaigns?: { offers?: AuditOffer[] }[] }} CampaignFile
 */

/**
 * @param {CampaignFile} file
 */
export function flattenCampaignOffers(file) {
  const campaigns = Array.isArray(file?.campaigns) ? file.campaigns : [];
  const offers = [];
  for (const campaign of campaigns) {
    for (const offer of campaign.offers ?? []) {
      offers.push(offer);
    }
  }
  return offers;
}

/**
 * @param {CampaignFile} file
 * @param {{ minOffers?: number, label?: string }} [options]
 */
export function sanityCheckCampaignFile(file, options = {}) {
  const minOffers = options.minOffers ?? 8;
  const label = options.label ?? "campaign file";
  const issues = [];
  const campaigns = file?.campaigns;
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    issues.push({ level: "critical", message: `${label}: missing campaigns[]` });
    return issues;
  }
  const offers = flattenCampaignOffers(file);
  if (offers.length < minOffers) {
    issues.push({
      level: "critical",
      message: `${label}: only ${offers.length} offers (need at least ${minOffers})`,
    });
  }
  for (const offer of offers) {
    if (!offer.name?.trim() || typeof offer.price !== "number" || offer.price <= 0) {
      issues.push({
        level: "warning",
        message: `${label}: invalid row ${JSON.stringify(offer).slice(0, 80)}`,
      });
    }
  }
  return issues;
}

/**
 * @param {AuditOffer[]} expectedOffers
 * @param {AuditOffer[]} actualOffers
 * @param {{ priceEpsilon?: number }} [options]
 */
export function compareOfferSets(expectedOffers, actualOffers, options = {}) {
  const priceEpsilon = options.priceEpsilon ?? 0.02;
  const actualByKey = new Map(actualOffers.map((offer) => [offerAuditKey(offer), offer]));
  const missing = [];
  const priceMismatches = [];

  for (const expected of expectedOffers) {
    const key = offerAuditKey(expected);
    const actual = actualByKey.get(key);
    if (!actual) {
      missing.push(expected);
      continue;
    }
    const delta = Math.abs(Number(expected.price) - Number(actual.price));
    if (delta > priceEpsilon) {
      priceMismatches.push({
        key,
        expectedPrice: expected.price,
        actualPrice: actual.price,
      });
    }
    actualByKey.delete(key);
  }

  const extra = [...actualByKey.values()];
  const critical = missing.length + priceMismatches.length;
  return { missing, extra, priceMismatches, criticalCount: critical };
}

/**
 * Vision re-read audit: tolerate OCR caps, detail abbreviations, and split brand fields.
 *
 * @param {AuditOffer[]} expectedOffers
 * @param {AuditOffer[]} actualOffers
 * @param {{ priceEpsilon?: number }} [options]
 */
export function compareVisionOfferSets(expectedOffers, actualOffers, options = {}) {
  const priceEpsilon = options.priceEpsilon ?? 0.02;
  const remainingActual = [...actualOffers];
  const missing = [];
  const priceMismatches = [];

  for (let expectedIndex = 0; expectedIndex < expectedOffers.length; expectedIndex += 1) {
    const expected = expectedOffers[expectedIndex];
    const matchIndex = findBestVisionMatchIndex(expected, remainingActual, priceEpsilon);
    if (matchIndex < 0) {
      missing.push(expected);
      continue;
    }
    const actual = remainingActual[matchIndex];
    const laterExpected = expectedOffers.slice(expectedIndex + 1);
    const keepForLater = laterExpected.some((other) => visionOffersAlign(other, actual, priceEpsilon));
    if (!keepForLater) {
      remainingActual.splice(matchIndex, 1);
    }
    const delta = visionPriceDelta(Number(expected.price), Number(actual.price), priceEpsilon);
    if (delta > priceEpsilon) {
      priceMismatches.push({
        key: visionAuditKey(expected),
        expectedPrice: expected.price,
        actualPrice: actual.price,
      });
    }
  }

  const extra = remainingActual;
  const critical = missing.length + priceMismatches.length;
  return { missing, extra, priceMismatches, criticalCount: critical };
}

/**
 * @param {string | null | undefined} liveHash
 * @param {string | null | undefined} cachedHash
 */
export function describeFlyerHashAlignment(liveHash, cachedHash) {
  if (!liveHash) {
    return { status: "unknown", level: "warning", message: "Could not read live flyer hash." };
  }
  if (!cachedHash) {
    return { status: "no-cache", level: "warning", message: "Campaign cache has no flyerHash." };
  }
  if (liveHash === cachedHash) {
    return { status: "aligned", level: "info", message: "Live flyer hash matches cache (vision audit skipped)." };
  }
  return {
    status: "stale",
    level: "critical",
    message: `Live flyer hash ${liveHash} differs from cache ${cachedHash}.`,
  };
}

/**
 * @param {{ level?: string }[]} issues
 */
export function hasCriticalIssues(issues) {
  return issues.some((issue) => issue.level === "critical");
}