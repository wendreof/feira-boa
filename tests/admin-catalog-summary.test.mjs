import assert from "node:assert/strict";
import test from "node:test";
import { summarizeCatalog, summarizeStoreCatalog, sourceHealthLabel } from "../scripts/domain/admin-catalog-summary.mjs";
import { buildSnapshotManifest } from "../scripts/feed/snapshot-manifest.mjs";

const feed = {
  updatedAt: "2026-11-02T12:00:00.000Z",
  stores: [
    { name: "Alpha", branch: "Centro", sourceUrl: "https://alpha.test/a.pdf", from: "2026-11-02", to: "2026-11-04" },
    { name: "Beta", branch: "Norte", sourceUrl: "https://beta.test/b.pdf", from: "2026-10-20", to: "2026-10-25" },
  ],
  offers: [
    { store: "Alpha", validFrom: "2026-11-02", validTo: "2026-11-04" },
    { store: "Alpha", validFrom: "2026-11-02", validTo: "2026-11-03" },
    { store: "Beta", validFrom: "2026-10-20", validTo: "2026-10-25" },
  ],
  archivedCampaigns: [{
    store: { name: "Beta", to: "2026-10-25" },
    offers: [{ id: "arch-1" }, { id: "arch-2" }],
  }],
};

test("summarizeCatalog counts active, archived and source review", () => {
  const summary = summarizeCatalog(feed, "2026-11-02", {
    "https://alpha.test/a.pdf": { needsReview: false, error: false },
    "https://beta.test/old.pdf": { needsReview: true, error: false },
  });
  assert.equal(summary.activeCount, 2);
  assert.equal(summary.archivedOffers, 2);
  assert.equal(summary.sourcesNeedingReview, 1);
  assert.equal(summary.storesWithoutActive, 1);
  assert.equal(summary.expiringSoon, 1);
});

test("summarizeStoreCatalog exposes archive counts", () => {
  const beta = summarizeStoreCatalog(feed.stores[1], feed, "2026-11-02");
  assert.equal(beta.activeCount, 0);
  assert.equal(beta.archivedCount, 2);
});

test("sourceHealthLabel maps monitor flags", () => {
  assert.equal(sourceHealthLabel({ needsReview: true }).tone, "review");
  assert.equal(sourceHealthLabel({ error: true }).tone, "error");
});

test("buildSnapshotManifest lists current and previous snapshots", () => {
  const manifest = buildSnapshotManifest({
    feedUpdatedAt: "2026-11-02T12:00:00.000Z",
    snapshots: [{ storeId: "alpha", store: feed.stores[0], fetchedAt: "2026-11-02T10:00:00.000Z", offers: [{}] }],
    previousSnapshots: [{ storeId: "beta", store: feed.stores[1], supersededAt: "2026-11-01T10:00:00.000Z", offers: [{}, {}] }],
  });
  assert.equal(manifest.current.length, 1);
  assert.equal(manifest.previous[0].offerCount, 2);
});
