import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeCachedAvatarPath } from "../scripts/domain/avatar-cache.mjs";
import { writeCachedSidebarAvatarSrc } from "../scripts/domain/sidebar-avatar-src-cache.mjs";
import { sidebarAvatarUrlsToTry } from "../scripts/domain/sidebar-avatar-prime.mjs";

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

const OAUTH = "https://lh3.googleusercontent.com/a/oauth-purple";
const USER = "user-a";

describe("sidebarAvatarUrlsToTry", () => {
  it("prefers a cached sidebar src across navigations", () => {
    const storage = mockStorage();
    const stable = "https://lh3.googleusercontent.com/a/oauth-purple";
    writeCachedSidebarAvatarSrc(USER, stable, storage);
    writeCachedAvatarPath(USER, `${USER}/avatar.webp`, storage);
    const urls = sidebarAvatarUrlsToTry(USER, storage, "https://lh3.googleusercontent.com/a/other");
    assert.deepEqual(urls, [stable]);
  });

  it("uses storage render + object URLs when a bucket path exists (never OAuth)", () => {
    const storage = mockStorage();
    writeCachedAvatarPath(USER, `${USER}/avatar.webp`, storage);
    const urls = sidebarAvatarUrlsToTry(USER, storage, OAUTH);
    assert.equal(urls?.length, 2);
    assert.match(urls[0], /render\/image/);
    assert.match(urls[1], /object\/public\/avatars/);
    assert.doesNotMatch(urls.join("|"), /googleusercontent/);
  });

  it("uses OAuth when the profile path cache is null", () => {
    const storage = mockStorage();
    writeCachedAvatarPath(USER, null, storage);
    assert.deepEqual(sidebarAvatarUrlsToTry(USER, storage, OAUTH), [OAUTH]);
  });

  it("uses OAuth on cache miss", () => {
    const storage = mockStorage();
    assert.deepEqual(sidebarAvatarUrlsToTry(USER, storage, OAUTH), [OAUTH]);
  });

  it("returns null when there is no path and no OAuth url", () => {
    const storage = mockStorage();
    writeCachedAvatarPath(USER, null, storage);
    assert.equal(sidebarAvatarUrlsToTry(USER, storage, null), null);
  });
});