import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AVATAR_PATH_CACHE_KEY,
  clearCachedAvatarPath,
  readCachedAvatarPath,
  writeCachedAvatarPath,
} from "../scripts/domain/avatar-cache.mjs";

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

describe("avatar-cache", () => {
  it("returns undefined when storage is empty", () => {
    const storage = mockStorage();
    assert.equal(readCachedAvatarPath("user-a", storage), undefined);
  });

  it("round-trips path for the same user", () => {
    const storage = mockStorage();
    writeCachedAvatarPath("user-a", "user-a/avatar.webp", storage);
    assert.equal(readCachedAvatarPath("user-a", storage), "user-a/avatar.webp");
  });

  it("stores null when the user removed their photo", () => {
    const storage = mockStorage();
    writeCachedAvatarPath("user-a", null, storage);
    assert.equal(readCachedAvatarPath("user-a", storage), null);
  });

  it("ignores cache written for another user", () => {
    const storage = mockStorage();
    writeCachedAvatarPath("user-a", "user-a/avatar.webp", storage);
    assert.equal(readCachedAvatarPath("user-b", storage), undefined);
  });

  it("clears the cache entry", () => {
    const storage = mockStorage();
    writeCachedAvatarPath("user-a", "user-a/avatar.webp", storage);
    clearCachedAvatarPath(storage);
    assert.equal(storage.getItem(AVATAR_PATH_CACHE_KEY), null);
  });
});
