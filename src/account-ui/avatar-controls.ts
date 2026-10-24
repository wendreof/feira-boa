import { avatarUrl, loadAvatar, removeAvatar, uploadAvatar } from "../avatar";
import { errorMessage } from "../account";
import { accountState } from "./state";
import { setStatus } from "./ui";
import {
  avatarFile,
  avatarImage,
  avatarPlaceholder,
  avatarRemoveButton,
  avatarSaveButton,
  avatarStatus,
} from "./dom";

export function setAvatarStatus(message: string): void {
  if (avatarStatus) avatarStatus.textContent = message;
  setStatus(message);
}

export function renderAvatar(): void {
  const path = accountState.avatarPath;
  if (avatarImage) {
    if (path) {
      avatarImage.src = avatarUrl(path);
      avatarImage.hidden = false;
    } else {
      avatarImage.removeAttribute("src");
      avatarImage.hidden = true;
    }
  }
  if (avatarPlaceholder) avatarPlaceholder.hidden = Boolean(path);
  if (avatarRemoveButton) avatarRemoveButton.disabled = !path;
}

export async function refreshAvatar(): Promise<void> {
  const current = await loadAvatar(accountState.userId);
  accountState.avatarPath = current.path;
  renderAvatar();
}

async function saveAvatar(button: HTMLButtonElement): Promise<void> {
  const file = avatarFile?.files?.[0];
  if (!file) {
    setAvatarStatus("Escolha uma imagem para enviar.");
    return;
  }
  button.disabled = true;
  setAvatarStatus("Enviando a foto do perfil…");
  try {
    accountState.avatarPath = await uploadAvatar(accountState.userId, file, accountState.avatarPath);
    if (avatarFile) avatarFile.value = "";
    renderAvatar();
    setAvatarStatus("Foto do perfil atualizada.");
  } catch (error) {
    setAvatarStatus(`Não foi possível enviar a foto: ${errorMessage(error)}`);
  } finally {
    button.disabled = false;
  }
}

async function removeAvatarPhoto(button: HTMLButtonElement): Promise<void> {
  const path = accountState.avatarPath;
  if (!path) {
    setAvatarStatus("Você ainda não tem uma foto do perfil.");
    return;
  }
  button.disabled = true;
  setAvatarStatus("Removendo a foto do perfil…");
  try {
    await removeAvatar(accountState.userId, path);
    accountState.avatarPath = null;
    if (avatarFile) avatarFile.value = "";
    setAvatarStatus("Foto do perfil removida.");
  } catch (error) {
    setAvatarStatus(`Não foi possível remover a foto: ${errorMessage(error)}`);
  } finally {
    renderAvatar();
    button.disabled = false;
  }
}

export function bindAvatarControls(): void {
  const saveButton = avatarSaveButton;
  const removeButton = avatarRemoveButton;
  if (saveButton) saveButton.addEventListener("click", () => saveAvatar(saveButton));
  if (removeButton) removeButton.addEventListener("click", () => removeAvatarPhoto(removeButton));
}
