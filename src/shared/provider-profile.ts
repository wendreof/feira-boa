import { isStorageAvatarPath as isStorageAvatarPathFromDomain } from "../../scripts/domain/avatar-storage-path.mjs";

/** Bucket-relative avatar path vs remote OAuth URL. */
export const isStorageAvatarPath = isStorageAvatarPathFromDomain;

/** Remote profile photo from OAuth (X, Google, …). */
export function providerAvatarUrlFromMetadata(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null;
  for (const key of ["avatar_url", "picture", "profile_image_url"]) {
    const value = metadata[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) return value.trim();
  }
  return null;
}