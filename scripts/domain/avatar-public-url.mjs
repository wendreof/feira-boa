export const AVATAR_BUCKET = "avatars";
export const SUPABASE_PROJECT_URL = "https://muiuvmhzzbqflxznpnez.supabase.co";

/**
 * Public Supabase Storage URL for an avatar object path.
 * @param {string} path Object path inside the avatars bucket (e.g. "user-id/avatar.webp").
 * @param {number | undefined} sizePx Optional render transform edge length in pixels.
 */
export function avatarPublicUrl(path, sizePx) {
  const trimmed = path.trim();
  const segments = trimmed.split("/").map((segment) => encodeURIComponent(segment));
  const objectPath = segments.join("/");
  if (!sizePx) {
    return `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${objectPath}`;
  }
  const params = new URLSearchParams({
    width: String(sizePx),
    height: String(sizePx),
    resize: "cover",
    quality: "80",
  });
  return `${SUPABASE_PROJECT_URL}/storage/v1/render/image/public/${AVATAR_BUCKET}/${objectPath}?${params}`;
}
