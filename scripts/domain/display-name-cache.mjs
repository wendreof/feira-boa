export const DISPLAY_NAME_CACHE_KEY = "feira-boa:display-name:v1";

const METADATA_KEYS = ["display_name", "full_name", "name", "given_name", "user_name", "preferred_username"];

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function cleanName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 2 ? name : null;
}

/**
 * @param {string} userId
 * @param {Pick<Storage, "getItem"> | null | undefined} storage
 * @returns {string | null | undefined} undefined on cache miss or another user
 */
export function readCachedDisplayName(userId, storage) {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(DISPLAY_NAME_CACHE_KEY);
    if (!raw) return undefined;
    const entry = JSON.parse(raw);
    if (entry.userId !== userId) return undefined;
    return cleanName(entry.name);
  } catch {
    return undefined;
  }
}

/**
 * @param {string} userId
 * @param {string | null} name
 * @param {Pick<Storage, "setItem"> | null | undefined} storage
 */
export function writeCachedDisplayName(userId, name, storage) {
  if (!storage) return;
  try {
    storage.setItem(DISPLAY_NAME_CACHE_KEY, JSON.stringify({ userId, name: cleanName(name) }));
  } catch {
    // Private mode or quota; the sidebar can fall back to the session metadata.
  }
}

/** @param {Pick<Storage, "removeItem"> | null | undefined} storage */
export function clearCachedDisplayName(storage) {
  if (!storage) return;
  try {
    storage.removeItem(DISPLAY_NAME_CACHE_KEY);
  } catch {
    // ignore
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} metadata
 * @returns {string | null}
 */
export function displayNameFromMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return null;
  for (const key of METADATA_KEYS) {
    const name = cleanName(metadata[key]);
    if (name) return name;
  }
  return null;
}
