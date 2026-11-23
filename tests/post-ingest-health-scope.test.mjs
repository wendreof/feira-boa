import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeIngestStoreFilter,
  snapshotAgeStoreIds,
  visionCacheStoreIds,
} from "../scripts/domain/post-ingest-health-scope.mjs";

test("normalizeIngestStoreFilter treats all as full ingest", () => {
  assert.equal(normalizeIngestStoreFilter(undefined), null);
  assert.equal(normalizeIngestStoreFilter("all"), null);
  assert.equal(normalizeIngestStoreFilter("  corso "), "corso");
});

test("scoped snapshot checks skip unrelated stores on partial ingest", () => {
  assert.deepEqual(snapshotAgeStoreIds(null), ["paguemenos", "bigbom", "spani"]);
  assert.deepEqual(snapshotAgeStoreIds("corso"), []);
  assert.deepEqual(snapshotAgeStoreIds("paguemenos"), ["paguemenos"]);
});

test("scoped vision cache checks follow dispatched store", () => {
  assert.deepEqual(visionCacheStoreIds(null), ["spasso", "corso"]);
  assert.deepEqual(visionCacheStoreIds("corso"), ["corso"]);
  assert.deepEqual(visionCacheStoreIds("paguemenos"), []);
});