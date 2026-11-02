export const AVATAR_PATH_CACHE_KEY = "feira-boa:avatar-path:v1";

/** @typedef {{ userId: string, path: string | null }} AvatarPathCacheEntry */

/**
 * @param {string} userId
 * @param {Pick<Storage, "getItem"> | null | undefined} storage
 * @returns {string | null | undefined} undefined when cache miss or another user
 */
export function readCachedAvatarPath(userId, storage) {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(AVATAR_PATH_CACHE_KEY);
    if (!raw) return undefined;
    /** @type {AvatarPathCacheEntry} */
    const entry = JSON.parse(raw);
    if (entry.userId !== userId) return undefined;
    return entry.path ?? null;
  } catch {
    return undefined;
  }
}

/**
 * @param {string} userId
 * @param {string | null} path
 * @param {Pick<Storage, "setItem"> | null | undefined} storage
 */
export function writeCachedAvatarPath(userId, path, storage) {
  if (!storage) return;
  try {
    /** @type {AvatarPathCacheEntry} */
    const entry = { userId, path };
    storage.setItem(AVATAR_PATH_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Private mode or quota; showing the photo is optional.
  }
}

/** @param {Pick<Storage, "removeItem"> | null | undefined} storage */
export function clearCachedAvatarPath(storage) {
  if (!storage) return;
  try {
    storage.removeItem(AVATAR_PATH_CACHE_KEY);
  } catch {
    // ignore
  }
}
