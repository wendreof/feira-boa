import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleFeed } from "../scripts/feed/assemble-feed.mjs";

const store = (name) => ({ name, branch: "Centro", sourceUrl: `https://${name.toLowerCase()}.test/`, from: "2026-10-22", to: "2026-10-25" });
const offer = (id, storeName, name, extra = {}) => ({
  id, store: storeName, name, brand: "", detail: "Unidade", note: "", price: 10, previousPrice: null,
  validFrom: "2026-10-22", validTo: "2026-10-25", sourceUrl: `https://${storeName.toLowerCase()}.test/`,
  category: "Mercearia", ...extra,
});

const fallbackStores = [store("Alpha"), store("Beta")];
const fallbackOffers = [offer("a-1", "Alpha", "Arroz"), offer("b-1", "Beta", "Feijão")];

test("uses the curated fallback catalog when there are no snapshots", () => {
  const { feed, warnings } = assembleFeed({
    fallbackStores, fallbackOffers, fallbackUpdatedAt: "2026-10-22T00:00:00.000Z", snapshots: [],
  });
  assert.deepEqual(feed.offers.map((o) => o.id).sort(), ["a-1", "b-1"]);
  assert.equal(feed.updatedAt, "2026-10-22T00:00:00.000Z");
  assert.deepEqual(warnings.missingSnapshotStores, []);
});

test("prefers snapshots and drops fallback offers for stores without a snapshot", () => {
  const snapshots = [{
    storeId: "alpha", store: store("Alpha"), fetchedAt: "2026-10-24T10:00:00.000Z",
    offers: [offer("a-live", "Alpha", "Café")],
  }];
  const { feed, warnings } = assembleFeed({
    fallbackStores, fallbackOffers, fallbackUpdatedAt: "2026-10-22T00:00:00.000Z", snapshots,
  });
  assert.deepEqual(feed.offers.map((o) => o.id), ["a-live"]);
  assert.deepEqual(warnings.missingSnapshotStores, ["Beta"]);
  assert.equal(feed.updatedAt, "2026-10-24T10:00:00.000Z");
});

test("drops offers whose name is emptied by cleaning and reports them", () => {
  const snapshots = [{
    storeId: "alpha", store: store("Alpha"), fetchedAt: "2026-10-24T10:00:00.000Z",
    offers: [offer("a-ok", "Alpha", "Café"), offer("a-frag", "Alpha", "NESTA EMBALAGEM A UNIDADE SAI POR:")],
  }];
  const { feed, warnings } = assembleFeed({
    fallbackStores, fallbackOffers, fallbackUpdatedAt: "2026-10-22T00:00:00.000Z", snapshots,
  });
  assert.deepEqual(feed.offers.map((o) => o.id), ["a-ok"]);
  assert.deepEqual(warnings.droppedOffers, ["a-frag"]);
});

test("ignores snapshots without offers", () => {
  const snapshots = [{ storeId: "alpha", store: store("Alpha"), fetchedAt: "2026-10-30T00:00:00.000Z", offers: [] }];
  const { feed } = assembleFeed({
    fallbackStores, fallbackOffers, fallbackUpdatedAt: "2026-10-22T00:00:00.000Z", snapshots,
  });
  assert.equal(feed.updatedAt, "2026-10-22T00:00:00.000Z");
  assert.deepEqual(feed.offers.map((o) => o.id).sort(), ["a-1", "b-1"]);
});
