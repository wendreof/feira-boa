import assert from "node:assert/strict";
import test from "node:test";
import {
  PROMO_TAG_BLACK_FRIDAY,
  offerHasPromoTag,
  promoTagsForCampaign,
} from "../scripts/domain/offer-promo-tags.mjs";

test("promoTagsForCampaign keeps explicit tags and detects Black Friday labels", () => {
  assert.deepEqual(promoTagsForCampaign({ promoTags: ["vip"] }), ["vip"]);
  assert.deepEqual(promoTagsForCampaign({ label: "Black Friday 2026" }), [PROMO_TAG_BLACK_FRIDAY]);
  assert.deepEqual(
    promoTagsForCampaign({ promoTags: ["vip"], banner: "Semana Black Friday" }),
    ["vip", PROMO_TAG_BLACK_FRIDAY],
  );
});

test("offerHasPromoTag matches published feed offers", () => {
  assert.equal(offerHasPromoTag({ promoTags: [PROMO_TAG_BLACK_FRIDAY] }, PROMO_TAG_BLACK_FRIDAY), true);
  assert.equal(offerHasPromoTag({ promoTags: ["vip"] }, PROMO_TAG_BLACK_FRIDAY), false);
  assert.equal(offerHasPromoTag({}, PROMO_TAG_BLACK_FRIDAY), false);
});