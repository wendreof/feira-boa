import { supabase } from "./supabase-client";

export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

export interface AvatarState {
  path: string | null;
  url: string | null;
}

const extensionByMimeType: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

const extensionByFileExtension: Record<string, string> = {
  png: "png",
  jpg: "jpg",
  jpeg: "jpg",
  webp: "webp",
};

function avatarBucket() {
  return supabase.storage.from(AVATAR_BUCKET);
}

export function avatarFileName(mimeType: string, fileName?: string): string | null {
  const extension = extensionByMimeType[mimeType?.toLowerCase?.() ?? ""]
    ?? extensionByFileExtension[(fileName ?? "").split(".").pop()?.toLowerCase() ?? ""];
  return extension ? `avatar.${extension}` : null;
}

export function avatarUrl(path: string): string {
  return avatarBucket().getPublicUrl(path).data.publicUrl;
}

export async function loadAvatar(userId: string): Promise<AvatarState> {
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const path = data?.avatar_path ?? null;
  return { path, url: path ? avatarUrl(path) : null };
}

export async function uploadAvatar(userId: string, file: File, currentPath: string | null): Promise<string> {
  const mimeType = file.type.toLowerCase();
  const fileName = avatarFileName(mimeType, file.name);
  if (!fileName) throw new Error("Escolha uma imagem PNG, JPG ou WebP.");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("A imagem deve ter no máximo 2 MB.");

  const path = `${userId}/${fileName}`;
  const { error: uploadError } = await avatarBucket().upload(path, file, { contentType: mimeType || `image/${extensionByFileExtension[fileName.split(".").pop() ?? ""] ?? "jpeg"}`, upsert: true });
  if (uploadError) throw uploadError;

  // Upsert so accounts without a profiles row still persist the avatar path.
  const { error: updateError } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, avatar_path: path }, { onConflict: "user_id" });
  if (updateError) {
    await avatarBucket().remove([path]).catch((cleanupError: unknown) => {
      console.warn("Could not remove the avatar file after a failed profile update.", cleanupError);
    });
    throw updateError;
  }

  if (currentPath && currentPath !== path) {
    await avatarBucket().remove([currentPath]).catch((cleanupError: unknown) => {
      console.warn("Could not remove the previous avatar file.", cleanupError);
    });
  }
  return path;
}

export async function removeAvatar(userId: string, currentPath: string | null): Promise<void> {
  if (currentPath) {
    const { error } = await avatarBucket().remove([currentPath]);
    if (error && !isMissingObjectError(error.message)) throw error;
  }
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("user_id", userId);
  if (updateError) throw updateError;
}

function isMissingObjectError(message: string): boolean {
  return message.toLowerCase().includes("not found") || message.toLowerCase().includes("does not exist");
}
