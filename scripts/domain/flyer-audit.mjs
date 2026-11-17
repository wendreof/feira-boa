// @ts-nocheck
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