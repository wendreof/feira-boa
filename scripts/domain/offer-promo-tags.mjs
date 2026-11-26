import { foldText } from "../../src/shared/text.mjs";

/** Canonical tag id published on offers in offers.json */
export const PROMO_TAG_BLACK_FRIDAY = "black-friday";

const BLACK_FRIDAY_RE = /\bblack\s*friday\b/i;

/**
 * Promo tags for one flyer campaign block (manual JSON or parsed encarte).
 *
 * @param {{ promoTags?: string[], label?: string, banner?: string, title?: string } | null | undefined} campaign
 * @returns {string[]}
 */
export function promoTagsForCampaign(campaign) {
  const tags = new Set(
    Array.isArray(campaign?.promoTags)
      ? campaign.promoTags.filter((tag) => typeof tag === "string" && tag.trim())
      : [],
  );
  const labelText = foldText([campaign?.label, campaign?.banner, campaign?.title].filter(Boolean).join(" "));
  if (BLACK_FRIDAY_RE.test(labelText)) {
    tags.add(PROMO_TAG_BLACK_FRIDAY);
  }
  return [...tags];
}

/** @param {{ promoTags?: string[] } | null | undefined} offer @param {string} tag */
export function offerHasPromoTag(offer, tag) {
  return Array.isArray(offer?.promoTags) && offer.promoTags.includes(tag);
}