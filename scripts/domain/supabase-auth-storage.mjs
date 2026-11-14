/** Keep in sync with `src/supabase-config.ts` project ref (URL host). */
export const SUPABASE_PROJECT_REF = "muiuvmhzzbqflxznpnez";

export const SUPABASE_AUTH_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

/**
 * Reads the persisted Supabase session user id for this project only.
 * Ignores stray `sb-*-auth-token` keys from other hosts or preview environments.
 *
 * @param {Pick<Storage, "getItem"> | null | undefined} [storage]
 * @returns {string | null}
 */
export function readStoredAuthUserId(storage = globalThis.localStorage) {
  if (!storage) return null;
  try {
    let session = JSON.parse(storage.getItem(SUPABASE_AUTH_STORAGE_KEY) || "null");
    if (Array.isArray(session)) session = JSON.parse(session.join(""));
    if (!session?.access_token || !session?.user?.id) return null;
    const expiresAt = session.expires_at;
    if (typeof expiresAt === "number" && expiresAt * 1000 <= Date.now()) return null;
    return String(session.user.id);
  } catch {
    return null;
  }
}