import { test } from "node:test";
import assert from "node:assert/strict";
import { createOffer, DEFAULT_OFFER_TONE } from "../scripts/adapters/offer-factory.mjs";

const store = { name: "Alpha", logo: "https://alpha.test/logo.png", branch: "Centro", source: "Folheto oficial · Alpha" };
const taxonomy = { department: "Mercearia", productType: "Arroz", productTypes: ["Arroz"] };

test("builds the id from the store prefix and a slug of the key", () => {
  const offer = createOffer({
    storeId: "alpha", idKey: "Arroz Tipo 1 5kg 2026-10-22", store, sourceUrl: "https://alpha.test/ofertas",
    product: { name: "Arroz Tipo 1", detail: "5kg", price: 20 },
    validity: { from: "2026-10-22", to: "2026-10-25" }, taxonomy,
  });
  assert.equal(offer.id, "alpha-arroz-tipo-1-5kg-2026-10-22");
  assert.equal(offer.sourceUrl, "https://alpha.test/ofertas");
});

test("applies defaults for previous price, note and tone without a brand field", () => {
  const offer = createOffer({
    storeId: "alpha", idKey: "x", store, sourceUrl: "https://alpha.test/",
    product: { name: "Arroz", detail: "1kg", price: 9.9 },
    validity: { from: "2026-10-22", to: "2026-10-25" }, taxonomy,
  });
  assert.ok(!("brand" in offer), "the brand lives inside the name");
  assert.equal(offer.previousPrice, null);
  assert.equal(offer.note, "");
  assert.equal(offer.tone, DEFAULT_OFFER_TONE);
  assert.equal("storeCategory" in offer, false, "storeCategory is only present when the store provides it");
});

test("keeps storeCategory when the store provides it and derives the icon from the taxonomy", () => {
  const offer = createOffer({
    storeId: "alpha", idKey: "x", store, sourceUrl: "https://alpha.test/",
    product: { name: "Arroz", detail: "1kg", storeCategory: "Mercearia", price: 9.9, previousPrice: 12 },
    validity: { from: "2026-10-22", to: "2026-10-25" }, taxonomy,
  });
  assert.equal(offer.storeCategory, "Mercearia");
  assert.equal(offer.previousPrice, 12);
  assert.equal(typeof offer.icon, "string");
  assert.equal(offer.source, "Folheto oficial · Alpha");
});
