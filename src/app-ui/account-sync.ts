import { appState, type AccountApi, type ReactionsApi } from "./state";
import { applyTheme } from "../theme";
import { errorMessage } from "../errors";
import { linkPushDeviceToUser } from "../push";
import { renderOffers } from "./render";
import { refreshAlertsInvitePanel, syncAlertsInviteForUser } from "./alerts-invite";
import { refreshCatalogPushInvite } from "./catalog-push-invite";
import { providerAvatarUrlFromMetadata, importDisplayNameFromProvider } from "../account";
import { supabase } from "../supabase-client";
import { setAccountStatus, updateAccountControls, refreshTopbarAvatar, primeTopbarAvatar } from "./topbar";

function readGuestFavorites(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("feira-boa:favorites:v1") ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export async function loadAccountApi(): Promise<AccountApi> {
  appState.accountApi ??= await import("../account");
  return appState.accountApi;
}

export async function loadReactionsApi(): Promise<ReactionsApi> {
  appState.reactionsApi ??= await import("../offer-reactions");
  return appState.reactionsApi;
}

export async function saveFavoriteChanges(): Promise<void> {
  if (!appState.currentUserId) return;
  try {
    const api = await loadAccountApi();
    appState.preferences.favoriteOfferIds = [...appState.favoriteIds];
    await api.savePreferences(appState.currentUserId, appState.preferences);
    setAccountStatus("Favoritos sincronizados.");
  } catch (error) {
    setAccountStatus(`Favoritos salvos. Sincronização falhou: ${errorMessage(error)}`);
  }
}

export async function saveThemePreference(): Promise<void> {
  if (!appState.currentUserId) return;
  try {
    const api = await loadAccountApi();
    await api.savePreferences(appState.currentUserId, appState.preferences);
    appState.pendingTheme = null;
    setAccountStatus("Tema salvo nas preferências da sua conta.");
  } catch (error) {
    setAccountStatus(`Tema aplicado neste dispositivo. Não foi possível sincronizar: ${errorMessage(error)}`);
  }
}

export async function connectAccount(userId: string): Promise<void> {
  appState.currentUserId = userId;
  updateAccountControls();
  primeTopbarAvatar(userId);
  try {
    const api = await loadAccountApi();
    const { preferences: remotePreferences, avatarPath } = await api.loadPreferences(userId);
    const guestFavorites = readGuestFavorites();
    appState.preferences = {
      ...remotePreferences,
      favoriteOfferIds: [...new Set([...remotePreferences.favoriteOfferIds, ...guestFavorites])],
      theme: appState.pendingTheme ?? remotePreferences.theme,
    };
    applyTheme(appState.preferences.theme);
    appState.favoriteIds = new Set(appState.preferences.favoriteOfferIds);
    await api.savePreferences(userId, appState.preferences);
    appState.pendingTheme = null;
    appState.preferencesLoaded = true;
    if (guestFavorites.size > 0) {
      try {
        localStorage.removeItem("feira-boa:favorites:v1");
      } catch {
        // The merged account copy is already saved; a leftover local key is harmless.
      }
    }
    try {
      const reactions = await loadReactionsApi();
      appState.userReactions = await reactions.loadUserOfferReactions(userId);
    } catch (reactionError) {
      console.warn("Could not load saved offer reactions.", reactionError);
    }
    const { data: authData } = await supabase.auth.getUser();
    const providerAvatar = providerAvatarUrlFromMetadata(authData.user?.user_metadata as Record<string, unknown> | undefined);
    void importDisplayNameFromProvider(userId)
      .catch(() => null)
      .finally(() => { void refreshTopbarAvatar(userId, avatarPath, providerAvatar); });
    void linkPushDeviceToUser(userId);
    await syncAlertsInviteForUser(userId);
    void refreshCatalogPushInvite();
    renderOffers();
    setAccountStatus("Conta conectada. Seus favoritos estão sincronizados.");
  } catch (error) {
    setAccountStatus(`Conta conectada. Não foi possível sincronizar preferências: ${errorMessage(error)}`);
    await syncAlertsInviteForUser(userId);
  }
}
