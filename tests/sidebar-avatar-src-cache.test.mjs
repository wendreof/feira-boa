import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SIDEBAR_AVATAR_SRC_CACHE_KEY,
  clearCachedSidebarAvatarSrc,
  readCachedSidebarAvatarSrc,
  writeCachedSidebarAvatarSrc,
} from "../scripts/domain/sidebar-avatar-src-cache.mjs";

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

describe("sidebar-avatar-src-cache", () => {
  it("returns undefined when storage is empty", () => {
    const storage = mockStorage();
    assert.equal(readCachedSidebarAvatarSrc("user-a", storage), undefined);
  });

  it("round-trips src for the same user", () => {
    const storage = mockStorage();
    const url = "https://lh3.googleusercontent.com/a/example";
    writeCachedSidebarAvatarSrc("user-a", url, storage);
    assert.equal(readCachedSidebarAvatarSrc("user-a", storage), url);
  });

  it("ignores cache written for another user", () => {
    const storage = mockStorage();
    writeCachedSidebarAvatarSrc("user-a", "https://example.com/a.png", storage);
    assert.equal(readCachedSidebarAvatarSrc("user-b", storage), undefined);
  });

  it("clears the cache entry", () => {
    const storage = mockStorage();
    writeCachedSidebarAvatarSrc("user-a", "https://example.com/a.png", storage);
    clearCachedSidebarAvatarSrc(storage);
    assert.equal(storage.getItem(SIDEBAR_AVATAR_SRC_CACHE_KEY), null);
  });
});