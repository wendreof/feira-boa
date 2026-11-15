import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DISPLAY_NAME_CACHE_KEY,
  clearCachedDisplayName,
  displayNameFromMetadata,
  readCachedDisplayName,
  writeCachedDisplayName,
} from "../scripts/domain/display-name-cache.mjs";

function mockStorage() {
  /** @type {Map<string, string>} */
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

describe("display-name-cache", () => {
  it("returns undefined when storage is empty", () => {
    assert.equal(readCachedDisplayName("user-a", mockStorage()), undefined);
  });

  it("round-trips the name for the same user", () => {
    const storage = mockStorage();
    writeCachedDisplayName("user-a", "  Wendreo   Fernandes ", storage);
    assert.equal(readCachedDisplayName("user-a", storage), "Wendreo Fernandes");
  });

  it("ignores a name cached for another user", () => {
    const storage = mockStorage();
    writeCachedDisplayName("user-a", "Wendreo Fernandes", storage);
    assert.equal(readCachedDisplayName("user-b", storage), undefined);
  });

  it("clears the cache entry", () => {
    const storage = mockStorage();
    writeCachedDisplayName("user-a", "Wendreo Fernandes", storage);
    clearCachedDisplayName(storage);
    assert.equal(storage.getItem(DISPLAY_NAME_CACHE_KEY), null);
  });

  it("prefers the saved display name over the provider name", () => {
    assert.equal(displayNameFromMetadata({
      full_name: "Provider Name",
      display_name: "Wendreo Fernandes",
    }), "Wendreo Fernandes");
  });

  it("falls back to the provider full name", () => {
    assert.equal(displayNameFromMetadata({ full_name: "Wendreo Fernandes" }), "Wendreo Fernandes");
    assert.equal(displayNameFromMetadata({}), null);
    assert.equal(displayNameFromMetadata(null), null);
  });
});
