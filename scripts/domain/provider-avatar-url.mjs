const AVATAR_METADATA_KEYS_BY_PROVIDER = {
  twitter: ["avatar_url", "profile_image_url", "picture"],
  x: ["avatar_url", "profile_image_url", "picture"],
  google: ["picture", "avatar_url", "profile_image_url"],
};

const DEFAULT_AVATAR_METADATA_KEYS = ["avatar_url", "picture", "profile_image_url"];

/** @param {{ app_metadata?: { provider?: string }, identities?: { provider?: string }[] } | null | undefined} user */
export function oauthProviderFromUser(user) {
  const fromApp = user?.app_metadata?.provider;
  if (typeof fromApp === "string" && fromApp.trim()) return fromApp.trim().toLowerCase();
  const identity = user?.identities?.find((entry) => typeof entry?.provider === "string" && entry.provider.trim());
  if (identity?.provider) return identity.provider.trim().toLowerCase();
  return null;
}

/**
 * @param {Record<string, unknown> | null | undefined} metadata
 * @param {string | null | undefined} [provider]
 */
export function providerAvatarUrlFromMetadata(metadata, provider) {
  if (!metadata || typeof metadata !== "object") return null;
  const normalized = String(provider ?? "").toLowerCase().trim();
  const keys = AVATAR_METADATA_KEYS_BY_PROVIDER[normalized] ?? DEFAULT_AVATAR_METADATA_KEYS;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) return value.trim();
  }
  return null;
}