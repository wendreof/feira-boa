import { readCachedAvatarPath } from "./avatar-cache.mjs";
import { avatarPublicUrl } from "./avatar-public-url.mjs";
import { readCachedSidebarAvatarSrc } from "./sidebar-avatar-src-cache.mjs";

/**
 * Ordered avatar image URLs for the sidebar on a fresh HTML load (navigation.js).
 * Custom storage photos never fall back to OAuth on this path — only OAuth when
 * the profile has no bucket path cached (null or miss).
 *
 * @param {string} userId
 * @param {Pick<Storage, "getItem"> | null | undefined} storage
 * @param {string | null} remoteOAuthUrl
 * @returns {string[] | null}
 */
export function sidebarAvatarUrlsToTry(userId, storage, remoteOAuthUrl) {
  const cachedSrc = readCachedSidebarAvatarSrc(userId, storage);
  if (cachedSrc) return [cachedSrc];

  const cachedPath = readCachedAvatarPath(userId, storage);
  if (typeof cachedPath === "string" && cachedPath.trim()) {
    const path = cachedPath.trim();
    return [avatarPublicUrl(path, 64), avatarPublicUrl(path, undefined)];
  }

  const oauth = typeof remoteOAuthUrl === "string" ? remoteOAuthUrl.trim() : "";
  const hasOAuth = /^https?:\/\//i.test(oauth);
  if (cachedPath === null && hasOAuth) return [oauth];
  if (cachedPath === undefined && hasOAuth) return [oauth];
  return null;
}