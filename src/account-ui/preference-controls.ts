import { bindThemeToggle } from "../theme";
import { errorMessage, saveDisplayName, savePreferences, setNotificationsPaused } from "../account";
import { accountState } from "./state";
import { setStatus } from "./ui";
import { checkedValues } from "./rules-controls";
import {
  displayNameInput,
  displayNameSaveButton,
  favoriteProductTypes,
  favoriteStores,
  favoritesForm,
  notificationsPaused,
} from "./dom";

/** Salva o tema escolhido nas preferências da conta. */
export async function saveThemePreference(): Promise<void> {
  try {
    await savePreferences(accountState.userId, accountState.preferences!);
    accountState.pendingTheme = null;
    setStatus("Tema salvo nas preferências da sua conta.");
  } catch (error) {
    setStatus(`Tema aplicado neste dispositivo. Não foi possível sincronizar: ${errorMessage(error)}`);
  }
}

export function bindThemeControls(): void {
  bindThemeToggle((theme) => {
    accountState.pendingTheme = theme;
    if (accountState.preferences) accountState.preferences.theme = theme;
    if (accountState.userId && accountState.preferencesLoaded) void saveThemePreference();
  });
}

async function saveFavorites(form: HTMLFormElement, event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const preferences = accountState.preferences;
  if (!preferences) return;
  const button = form.querySelector<HTMLButtonElement>("button[type='submit']")!;
  button.disabled = true;
  setStatus("Salvando preferências…");
  if (favoriteStores) preferences.favoriteStores = checkedValues(favoriteStores);
  if (favoriteProductTypes) preferences.favoriteProductTypes = checkedValues(favoriteProductTypes);
  try {
    await savePreferences(accountState.userId, preferences);
    setStatus("Preferências salvas e sincronizadas.");
  } catch (error) {
    setStatus(`Não foi possível salvar: ${errorMessage(error)}`);
  } finally {
    button.disabled = false;
  }
}

async function togglePaused(toggle: HTMLInputElement): Promise<void> {
  toggle.disabled = true;
  try {
    await setNotificationsPaused(accountState.userId, toggle.checked);
    setStatus(toggle.checked ? "Alertas pausados." : "Alertas retomados.");
  } catch (error) {
    toggle.checked = !toggle.checked;
    setStatus(`Não foi possível atualizar: ${errorMessage(error)}`);
  } finally {
    toggle.disabled = false;
  }
}

async function saveDisplayNameFromInput(button: HTMLButtonElement): Promise<void> {
  const value = displayNameInput?.value.trim() ?? "";
  if (value.length < 2) {
    setStatus("Informe como gostaria de ser chamado (mínimo de 2 letras).");
    displayNameInput?.focus();
    return;
  }
  button.disabled = true;
  try {
    const saved = await saveDisplayName(accountState.userId, value);
    if (displayNameInput) displayNameInput.value = saved;
    setStatus("Nome salvo. Ele aparece no topo do site e nos alertas.");
  } catch (error) {
    setStatus(`Não foi possível salvar o nome: ${errorMessage(error)}`);
  } finally {
    button.disabled = false;
  }
}

export function bindPreferenceControls(): void {
  const form = favoritesForm;
  const toggle = notificationsPaused;
  const saveButton = displayNameSaveButton;
  if (form && (favoriteStores || favoriteProductTypes)) form.addEventListener("submit", (event) => saveFavorites(form, event));
  if (toggle) toggle.addEventListener("change", () => togglePaused(toggle));
  if (saveButton) saveButton.addEventListener("click", () => saveDisplayNameFromInput(saveButton));
}
