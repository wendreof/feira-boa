import { isStorageAvatarPath as isStorageAvatarPathFromDomain } from "../../scripts/domain/avatar-storage-path.mjs";

/** Bucket-relative avatar path vs remote OAuth URL. */
export const isStorageAvatarPath = isStorageAvatarPathFromDomain;

type OAuthProviderHint = string | null | undefined;

const AVATAR_METADATA_KEYS_BY_PROVIDER: Record<string, string[]> = {
  twitter: ["avatar_url", "profile_image_url", "picture"],
  x: ["avatar_url", "profile_image_url", "picture"],
  google: ["picture", "avatar_url", "profile_image_url"],
};

const DEFAULT_AVATAR_METADATA_KEYS = ["avatar_url", "picture", "profile_image_url"];

/** Active OAuth provider from Supabase user payload. */
export function oauthProviderFromUser(user: {
  app_metadata?: { provider?: string };
  identities?: { provider?: string }[];
} | null | undefined): string | null {
  const fromApp = user?.app_metadata?.provider;
  if (typeof fromApp === "string" && fromApp.trim()) return fromApp.trim().toLowerCase();
  const identity = user?.identities?.find((entry) => typeof entry?.provider === "string" && entry.provider.trim());
  if (identity?.provider) return identity.provider.trim().toLowerCase();
  return null;
}

/** Remote profile photo from OAuth (X, Google, …). */
export function providerAvatarUrlFromMetadata(
  metadata: Record<string, unknown> | undefined,
  provider?: OAuthProviderHint,
): string | null {
  if (!metadata) return null;
  const normalized = provider?.toLowerCase()?.trim() ?? "";
  const keys = AVATAR_METADATA_KEYS_BY_PROVIDER[normalized] ?? DEFAULT_AVATAR_METADATA_KEYS;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) return value.trim();
  }
  return null;
}