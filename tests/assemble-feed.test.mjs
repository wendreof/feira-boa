import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleFeed } from "../scripts/feed/assemble-feed.mjs";

const store = (name) => ({ name, branch: "Centro", sourceUrl: `https://${name.toLowerCase()}.test/`, from: "2026-10-22", to: "2026-10-25" });
const offer = (id, storeName, name, extra = {}) => ({
  id, store: storeName, name, detail: "Unidade", note: "", price: 10, previousPrice: null,
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

test("metadata-only snapshots publish the store and skip fallback offers", () => {
  const snapshots = [{
    storeId: "alpha",
    store: store("Alpha"),
    fetchedAt: "2026-10-30T00:00:00.000Z",
    offers: [],
    flyerImages: ["https://alpha.test/flyer.png"],
  }];
  const { feed, warnings } = assembleFeed({
    fallbackStores, fallbackOffers, fallbackUpdatedAt: "2026-10-22T00:00:00.000Z", snapshots,
  });
  assert.equal(feed.updatedAt, "2026-10-30T00:00:00.000Z");
  assert.deepEqual(feed.offers.map((o) => o.id), []);
  assert.deepEqual(warnings.missingSnapshotStores, ["Beta"]);
  assert.deepEqual(feed.stores.find((entry) => entry.name === "Alpha")?.flyerImages, ["https://alpha.test/flyer.png"]);
});

test("publishes the previous snapshot as archivedCampaigns", () => {
  const snapshots = [{
    storeId: "alpha",
    store: store("Alpha"),
    fetchedAt: "2026-11-02T10:00:00.000Z",
    offers: [offer("a-live", "Alpha", "Café", { validFrom: "2026-11-02", validTo: "2026-11-04", sourceUrl: "https://alpha.test/new.pdf" })],
  }];
  snapshots[0].store.sourceUrl = "https://alpha.test/new.pdf";
  snapshots[0].store.from = "2026-11-02";
  snapshots[0].store.to = "2026-11-04";
  const previousSnapshots = [{
    storeId: "alpha",
    store: { ...store("Alpha"), sourceUrl: "https://alpha.test/old.pdf", from: "2026-10-29", to: "2026-11-01" },
    supersededAt: "2026-11-02T09:00:00.000Z",
    offers: [offer("a-old", "Alpha", "Arroz", { validFrom: "2026-10-29", validTo: "2026-11-01", sourceUrl: "https://alpha.test/old.pdf" })],
  }];
  const { feed } = assembleFeed({
    fallbackStores, fallbackOffers, fallbackUpdatedAt: "2026-10-22T00:00:00.000Z", snapshots, previousSnapshots,
  });
  assert.equal(feed.archivedCampaigns.length, 1);
  assert.match(feed.archivedCampaigns[0].offers[0].id, /^arch-alpha-/);
  assert.equal(feed.archivedCampaigns[0].offers[0].sourceUrl, "https://alpha.test/old.pdf");
});
