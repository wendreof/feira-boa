import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const feed = JSON.parse(await readFile(new URL("../offers.json", import.meta.url), "utf8"));

test("offer feed has the expected version and store catalog", () => {
  assert.equal(feed.schemaVersion, 1);
  assert.ok(feed.stores.length >= 4);
  assert.ok(feed.offers.length > 0);
});

test("every offer has a stable unique ID and valid price and dates", () => {
  const ids = feed.offers.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);

  for (const offer of feed.offers) {
    assert.match(offer.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(Number.isFinite(offer.price) && offer.price > 0, `${offer.id} has an invalid price`);
    assert.match(offer.validFrom, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(offer.validTo, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(offer.validFrom <= offer.validTo, `${offer.id} has reversed validity dates`);
    assert.match(offer.sourceUrl, /^https:\/\//);
    assert.ok(offer.productTypes.includes(offer.productType), `${offer.id} is missing its primary product type`);
  }
});

test("barbecue offers also keep their primary product type", () => {
  const barbecueOffers = feed.offers.filter((offer) => offer.productTypes.includes("Churrasco"));
  const meatTypes = new Set(["Carne bovina", "Carnes suínas", "Frango", "Frios", "Açougue e peixaria"]);
  assert.ok(barbecueOffers.length > 0);
  for (const offer of barbecueOffers) {
    assert.ok(offer.productTypes.includes(offer.productType), `${offer.id} lost its primary product type`);
  }
  // Data-rotating snapshots may drop a specific cut on any given day, so assert
  // the span (meat primaries stay represented) instead of one exact product type.
  assert.ok(barbecueOffers.some((offer) => meatTypes.has(offer.productType)));
});
