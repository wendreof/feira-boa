import test from "node:test";
import assert from "node:assert/strict";

import {
  partitionOfferCardCache,
  shouldRemountOffersSynchronously,
} from "../scripts/domain/offer-card-cache.mjs";

test("partitionOfferCardCache evicts stale offers and detaches non-matching", () => {
  const result = partitionOfferCardCache({
    cachedIds: ["a", "b", "c", "gone"],
    matchingIds: new Set(["a", "c"]),
    liveOfferIds: new Set(["a", "b", "c"]),
  });
  assert.deepEqual(result.evict, ["gone"]);
  assert.deepEqual(result.detach, ["b"]);
});

test("shouldRemountOffersSynchronously is true when every match is cached", () => {
  const cache = new Map([["1", {}], ["2", {}]]);
  assert.equal(shouldRemountOffersSynchronously([], cache), true);
  assert.equal(shouldRemountOffersSynchronously(["1", "2"], cache), true);
  assert.equal(shouldRemountOffersSynchronously(["1", "3"], cache), false);
});