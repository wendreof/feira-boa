import { errorMessage } from "./errors";
import type { OfferFeed } from "./types";
import { resolveCategory } from "./catalog-taxonomy.mjs";
import { applySourceFreshness } from "./source-freshness";
import { bindThemeToggle } from "./theme";
import { formatFeedUpdate } from "./view/format";
import { favoritesToggle, feedRetry, feedStatus, grid, mobileNavFavoritesLink, mobileNavOffersLink, navFavoritesLink, updatedLabel } from "./app-ui/dom";
import { bindCompactTopbar, setAccountStatus, updateAccountControls } from "./app-ui/topbar";
import { askForLogin, bindLoginDialog } from "./app-ui/login-prompt";
import { bindAppEvents, setFavoritesView } from "./app-ui/actions";
import { connectAccount, loadAccountApi, loadReactionsApi, saveThemePreference } from "./app-ui/account-sync";
import { syncAlertsInviteForUser, bindAlertsInviteUi } from "./app-ui/alerts-invite";
import { bindCatalogPushInvite, refreshCatalogPushInvite } from "./app-ui/catalog-push-invite";
import { readSavedDepartment } from "./app-ui/session-filters";
import { readViewMode, updateViewMode } from "./app-ui/view";
import { renderFilters, renderPopularItems, renderStoreFilters } from "./app-ui/filters";
import { renderOffers } from "./app-ui/render";
import { hideOfferGridLoading } from "./app-ui/offer-grid-loading";
import { appState } from "./app-ui/state";
import { supabase } from "./supabase-client";

function showFeedError(): void {
  hideOfferGridLoading();
  grid.replaceChildren();
  feedStatus.hidden = false;
  feedStatus.dataset.state = "error";
  feedStatus.textContent = "Não foi possível carregar as ofertas. Verifique sua conexão e tente novamente.";
  feedRetry.hidden = false;
  document.querySelector<HTMLParagraphElement>("#results-subtitle")!.textContent = "";
}

/** Estado inicial da página, a partir do feed e dos parâmetros da URL. */
function initializeState(feed: OfferFeed): void {
  const params = new URLSearchParams(window.location.search);
  appState.offers = feed.offers;
  appState.archivedCampaigns = feed.archivedCampaigns ?? [];
  appState.storeNames = ["Todas as lojas", ...new Set(feed.offers.map((offer) => offer.store))];
  appState.categories = new Map(feed.offers.map((offer) => [offer.id, resolveCategory(offer)]));
  for (const campaign of appState.archivedCampaigns) {
    for (const offer of campaign.offers) {
      appState.categories.set(offer.id, resolveCategory(offer));
    }
  }
  appState.favoriteOnly = params.get("view") === "favorites";
  appState.viewMode = readViewMode();
  appState.sharedOfferId = params.get("offer");
  if (appState.sharedOfferId && !feed.offers.some((offer) => offer.id === appState.sharedOfferId)) {
    appState.sharedOfferId = null;
  }
  if (!appState.sharedOfferId && !appState.favoriteOnly) {
    appState.activeDepartment = readSavedDepartment();
  }
}

function markCurrentNavigation(): void {
  if (appState.favoriteOnly) {
    navFavoritesLink.setAttribute("aria-current", "page");
    mobileNavFavoritesLink.setAttribute("aria-current", "page");
  } else {
    mobileNavOffersLink.setAttribute("aria-current", "page");
  }
}

function loadReactionTotals(): void {
  void (async () => {
    try {
      const reactions = await loadReactionsApi();
      appState.reactionCounts = await reactions.loadOfferReactionCounts();
      renderPopularItems();
      renderOffers();
    } catch (error) {
      console.warn("Could not load offer reaction totals.", error);
    }
  })();
}

async function becomeGuest(): Promise<void> {
  appState.currentUserId = null;
  appState.preferencesLoaded = false;
  document.documentElement.dataset.authBootstrap = "guest";
  updateAccountControls();
  await syncAlertsInviteForUser(null);
  void refreshCatalogPushInvite();
  setAccountStatus("Entre na sua conta para salvar seus favoritos e tê-los em qualquer dispositivo.");
  if (appState.favoriteOnly) {
    askForLogin(favoritesToggle, "favorite", () => {
      if (appState.currentUserId) return;
      setFavoritesView(false);
      const url = new URL(window.location.href);
      if (url.searchParams.get("view") === "favorites") {
        url.searchParams.delete("view");
        window.history.replaceState({}, "", url);
      }
    });
  }
}

async function connectAccountIfNeeded(userId: string): Promise<void> {
  if (appState.currentUserId === userId && appState.preferencesLoaded) {
    await syncAlertsInviteForUser(userId);
    return;
  }
  await connectAccount(userId);
}

function restoreAccountSession(): void {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") {
      void (async () => {
        try {
          if (session?.user) {
            await connectAccountIfNeeded(session.user.id);
            return;
          }
          await becomeGuest();
        } catch (error) {
          setAccountStatus(`Conta temporariamente indisponível: ${errorMessage(error)}`);
        }
      })();
      return;
    }
    if (event === "SIGNED_IN" && session?.user) {
      void connectAccountIfNeeded(session.user.id).catch((error: unknown) => {
        setAccountStatus(`Conta temporariamente indisponível: ${errorMessage(error)}`);
      });
      return;
    }
    if (event === "SIGNED_OUT") {
      void becomeGuest();
    }
  });
}

restoreAccountSession();

(async function startApp(): Promise<void> {
  feedStatus.textContent = "Carregando ofertas…";
  const feedResponse = await fetch("offers.json", { cache: "no-cache" });
  if (!feedResponse.ok) throw new Error(`Offer feed unavailable: ${feedResponse.status}`);
  const feed = await feedResponse.json() as OfferFeed;
  if (!Array.isArray(feed.offers) || !Array.isArray(feed.stores)) throw new Error("Offer feed has an invalid shape.");

  initializeState(feed);
  markCurrentNavigation();

  feedRetry.addEventListener("click", () => window.location.reload());
  bindCompactTopbar();
  bindLoginDialog();
  bindThemeToggle((theme) => {
    appState.preferences.theme = theme;
    appState.pendingTheme = theme;
    if (appState.currentUserId && appState.preferencesLoaded) void saveThemePreference();
  });
  bindAppEvents();
  bindAlertsInviteUi();
  bindCatalogPushInvite();
  void refreshCatalogPushInvite();

  updateViewMode();
  renderStoreFilters();
  renderPopularItems();
  renderFilters();
  renderOffers();
  applySourceFreshness();
  updatedLabel.textContent = formatFeedUpdate(feed.updatedAt);
  updatedLabel.title = "Data da última atualização do catálogo de ofertas";

  loadReactionTotals();
})().catch((error: unknown) => {
  console.error("Feira Boa could not load offers.", error);
  showFeedError();
});
