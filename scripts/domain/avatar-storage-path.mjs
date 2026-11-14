/** Bucket-relative avatar paths vs OAuth/provider URLs stored in profiles. */
export function isStorageAvatarPath(path) {
  return !/^https?:\/\//i.test(String(path ?? "").trim());
}