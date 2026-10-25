import { supabase } from "./supabase-client";
import { hideSpinner, showSpinner } from "./loading";

export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
/** Tamanho pedido à CDN para cada lugar de exibição (2x para telas densas). */
export const AVATAR_SIZE = { topbar: 64, preview: 144 } as const;
const AVATAR_MAX_EDGE = 512;
const AVATAR_RESIZED_MIME = "image/webp";
const AVATAR_RESIZE_QUALITY = 0.85;

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

export function avatarUrl(path: string, sizePx?: number): string {
  const options = sizePx
    ? { transform: { width: sizePx, height: sizePx, resize: "cover" as const, quality: 80 } }
    : undefined;
  return avatarBucket().getPublicUrl(path, options).data.publicUrl;
}

/**
 * Preenche a imagem no tamanho do lugar e mantém o spinner até ela carregar.
 * Se a CDN não servir a transformação, cai para o arquivo original.
 */
export function setAvatarImage(image: HTMLImageElement, path: string | null, sizePx: number): void {
  const host = image.parentElement;
  image.onload = null;
  image.onerror = null;
  if (!path) {
    hideSpinner(host);
    image.removeAttribute("src");
    image.hidden = true;
    return;
  }

  const sizedUrl = avatarUrl(path, sizePx);
  const fullUrl = avatarUrl(path);
  let retriedFullSize = false;
  image.hidden = true;
  showSpinner(host);
  const settle = (visible: boolean): void => {
    image.onload = null;
    image.onerror = null;
    hideSpinner(host);
    image.hidden = !visible;
  };
  image.onload = () => settle(true);
  image.onerror = () => {
    if (!retriedFullSize) {
      retriedFullSize = true;
      image.src = fullUrl;
      return;
    }
    settle(false);
  };
  image.src = sizedUrl;
  if (image.complete && image.naturalWidth > 0) settle(true);
}

/** Caminho do arquivo no bucket; nulo quando a conta não tem foto. */
export async function loadAvatar(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.avatar_path ?? null;
}

/**
 * Fotos de perfil nunca precisam de mais que 512px: redimensiona no navegador
 * para o arquivo chegar pequeno ao armazenamento, e devolve o original quando
 * o navegador não consegue reencodar ou o resultado não fica menor.
 */
async function resizeAvatar(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, AVATAR_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, AVATAR_RESIZED_MIME, AVATAR_RESIZE_QUALITY));
    if (!blob || blob.type !== AVATAR_RESIZED_MIME || blob.size >= file.size) return file;
    return new File([blob], file.name, { type: blob.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export async function uploadAvatar(userId: string, file: File, currentPath: string | null): Promise<string> {
  const mimeType = file.type.toLowerCase();
  const fileName = avatarFileName(mimeType, file.name);
  if (!fileName) throw new Error("Escolha uma imagem PNG, JPG ou WebP.");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("A imagem deve ter no máximo 2 MB.");

  const source = await resizeAvatar(file);
  const sourceMimeType = source.type.toLowerCase();
  const sourceFileName = avatarFileName(sourceMimeType, source.name) ?? fileName;
  const path = `${userId}/${sourceFileName}`;
  const contentType = sourceMimeType || `image/${extensionByFileExtension[sourceFileName.split(".").pop() ?? ""] ?? "jpeg"}`;
  const { error: uploadError } = await avatarBucket().upload(path, source, { contentType, upsert: true });
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
