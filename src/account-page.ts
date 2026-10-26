import {
  deleteAccount,
  errorMessage,
  getCurrentUser,
  importDisplayNameFromProvider,
  loadAccountSettings,
  loadDisplayName,
  signOut,
} from "./account";
import { requireOneSignal } from "./push";
import type { OfferFeed } from "./types";
import { applyTheme } from "./theme";
import { refreshAvatar, bindAvatarControls } from "./account-ui/avatar-controls";
import { detachOneSignalFromAccount } from "./account-ui/push-controls";
import { renderCheckboxes } from "./account-ui/options";
import { bindPreferenceControls, bindThemeControls, saveThemePreference } from "./account-ui/preference-controls";
import { accountState } from "./account-ui/state";
import { setActionsDisabled, setStatus } from "./account-ui/ui";
import { displayNameInput, email, favoriteProductTypes, favoriteStores, signOutButton, deleteAccountButton } from "./account-ui/dom";

function bindAccountActions(): void {
  signOutButton.addEventListener("click", async () => {
    setActionsDisabled(true);
    setStatus("Saindo…");
    try {
      await detachOneSignalFromAccount();
      await signOut();
      window.location.replace("index.html");
    } catch (error) {
      setStatus(`Não foi possível sair: ${errorMessage(error)}`);
      setActionsDisabled(false);
    }
  });

  deleteAccountButton.addEventListener("click", async () => {
    if (!window.confirm("Excluir sua conta e os dados sincronizados? Esta ação não pode ser desfeita.")) return;
    setActionsDisabled(true);
    setStatus("Excluindo conta…");
    try {
      await detachOneSignalFromAccount();
      await deleteAccount();
      window.location.replace("index.html");
    } catch (error) {
      setStatus(`Não foi possível excluir a conta: ${errorMessage(error)}`);
      setActionsDisabled(false);
    }
  });
}

/** Carrega a conta, preferências e opções de ofertas da sessão atual. */
async function loadAccount(user: { id: string; email?: string | null }): Promise<void> {
  accountState.userId = user.id;
  email.textContent = user.email ?? "E-mail não disponível";
  await refreshAvatar().catch((error: unknown) => {
    console.warn("Could not load the profile avatar.", error);
  });
  const [settings, response, savedName] = await Promise.all([
    loadAccountSettings(user.id),
    fetch("offers.json").then(async (result) => {
      if (!result.ok) throw new Error("Não foi possível carregar as opções de ofertas.");
      return await result.json() as OfferFeed;
    }),
    loadDisplayName(user.id).catch(() => null),
  ]);
  let displayName = settings.displayName ?? savedName;
  if (!displayName) {
    displayName = await importDisplayNameFromProvider(user.id).catch(() => null);
  }
  if (displayNameInput && displayName) displayNameInput.value = displayName;
  const preferences = settings.preferences;
  if (accountState.pendingTheme) preferences.theme = accountState.pendingTheme;
  accountState.preferences = preferences;
  applyTheme(preferences.theme);
  accountState.preferencesLoaded = true;
  accountState.accountPushEnabled = settings.pushEnabled;
  void (async () => {
    try {
      const oneSignal = await requireOneSignal();
      await oneSignal.login(accountState.userId);
    } catch (error) {
      console.warn("Could not associate OneSignal with the account.", error);
    }
  })();

  const stores = [...new Set(response.offers.map((offer) => offer.store))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const productTypes = [...new Set(response.offers.flatMap((offer) => offer.productTypes))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  renderCheckboxes(favoriteStores, stores, preferences.favoriteStores);
  renderCheckboxes(favoriteProductTypes, productTypes, preferences.favoriteProductTypes);
  if (accountState.pendingTheme) await saveThemePreference();
  setStatus("Suas preferências estão sincronizadas.");
}

bindThemeControls();
bindAvatarControls();
bindPreferenceControls();
bindAccountActions();

void getCurrentUser()
  .then(async (user) => {
    if (!user) {
      window.location.replace("login.html?returnTo=account.html");
      return;
    }
    await loadAccount(user);
  })
  .catch((error: unknown) => {
    email.textContent = "Não foi possível verificar sua sessão";
    setStatus(`Tente novamente: ${errorMessage(error)}`);
    setActionsDisabled(true);
  });
