import test from "node:test";
import assert from "node:assert/strict";
import { formatOfferPrice, getVerifiedActiveOffers, ruleMatchesOffer, saoPauloDate } from "../scripts/offer-matcher.mjs";
import { checkSiteHealth, validateBuildInfo, validateOfferFeed } from "../scripts/check-site-health.mjs";

const offer = {
  id: "offer-1",
  store: "Sempre Vale",
  productType: "Bebidas",
  productTypes: ["Bebidas", "Churrasco"],
  name: "Refrigerante",
  price: 7.49,
  validFrom: "2026-10-16",
  validTo: "2026-10-18",
  sourceUrl: "https://store.example/offers",
};

test("uses the São Paulo calendar date for daily matching", () => {
  assert.equal(saoPauloDate(new Date("2026-10-18T02:00:00.000Z")), "2026-10-17");
});

test("only includes active offers from tracked, verified sources", () => {
  const verified = { [offer.sourceUrl]: { needs_review: false } };
  assert.deepEqual(getVerifiedActiveOffers([offer], verified, "2026-10-18"), [offer]);
  assert.deepEqual(getVerifiedActiveOffers([offer], {}, "2026-10-18"), []);
  assert.deepEqual(getVerifiedActiveOffers([offer], { [offer.sourceUrl]: { needs_review: true } }, "2026-10-18"), []);
  assert.deepEqual(getVerifiedActiveOffers([offer], verified, "2026-10-19"), []);
});

test("matches store, product type, and target price", () => {
  assert.equal(ruleMatchesOffer({ store: "Sempre Vale", product_type: "Bebidas", target_price: 8 }, offer), true);
  assert.equal(ruleMatchesOffer({ product_type: "Churrasco", target_price: 8 }, offer), true);
  assert.equal(ruleMatchesOffer({ store: "Big Bom", product_type: "Bebidas", target_price: 8 }, offer), false);
  assert.equal(ruleMatchesOffer({ product_type: "Bebidas", target_price: 7 }, offer), false);
});

test("formats prices in Brazilian reais", () => {
  assert.equal(formatOfferPrice(7.49), "R$ 7,49");
});

test("site health check validates public HTML and data files", async () => {
  const feed = { schemaVersion: 1, updatedAt: "2026-10-18T00:00:00Z", stores: [{}], offers: [offer] };
  const buildInfo = { version: "1.0.0", commit: "abc1234", builtAt: "2026-10-18T00:00:00Z" };
  const fetchStub = async (url) => {
    if (url.pathname.endsWith("offers.json")) return Response.json(feed);
    if (url.pathname.endsWith("build-info.json")) return Response.json(buildInfo);
    return new Response("<!doctype html><title>Feira Boa</title>", { status: 200 });
  };
  assert.deepEqual(await checkSiteHealth("https://feira.example/", fetchStub), {
    host: "feira.example",
    filesChecked: 3,
    offers: 1,
  });
  assert.doesNotThrow(() => validateOfferFeed(feed));
  assert.doesNotThrow(() => validateBuildInfo(buildInfo));
});
