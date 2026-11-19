export const SIDEBAR_AVATAR_SRC_CACHE_KEY = "feira-boa:sidebar-avatar-src:v1";

/**
 * @param {string} src
 * @returns {string | null}
 */
function cleanSrc(src) {
  if (typeof src !== "string") return null;
  const trimmed = src.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/**
 * @param {string} userId
 * @param {Pick<Storage, "getItem"> | null | undefined} storage
 * @returns {string | null | undefined} undefined on cache miss or another user
 */
export function readCachedSidebarAvatarSrc(userId, storage) {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(SIDEBAR_AVATAR_SRC_CACHE_KEY);
    if (!raw) return undefined;
    const entry = JSON.parse(raw);
    if (entry.userId !== userId) return undefined;
    return cleanSrc(entry.src);
  } catch {
    return undefined;
  }
}

/**
 * @param {string} userId
 * @param {string | null} src
 * @param {Pick<Storage, "setItem"> | null | undefined} storage
 */
export function writeCachedSidebarAvatarSrc(userId, src, storage) {
  if (!storage) return;
  try {
    storage.setItem(
      SIDEBAR_AVATAR_SRC_CACHE_KEY,
      JSON.stringify({ userId, src: cleanSrc(src) }),
    );
  } catch {
    // Private mode or quota; navigation can still resolve from path or OAuth.
  }
}

/** @param {Pick<Storage, "removeItem"> | null | undefined} storage */
export function clearCachedSidebarAvatarSrc(storage) {
  if (!storage) return;
  try {
    storage.removeItem(SIDEBAR_AVATAR_SRC_CACHE_KEY);
  } catch {
    // ignore
  }
}