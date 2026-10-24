import { appState } from "./state";
import { askForLogin } from "./login-prompt";
import { errorMessage } from "../errors";
import { grid, filters, storeFilters, popularItems, input, priceMin, priceMax, productTypeSelect, sortSelect, resultsTitle, showAllOffersButton, shareStatus, resetButton, viewToggle, favoritesToggle, navFavoritesLink, mobileNavOffersLink, mobileNavFavoritesLink } from "./dom";
import { loadReactionsApi, saveFavoriteChanges } from "./account-sync";
import { mobileViewMedia, updateViewMode, persistViewMode } from "./view";
import { money } from "../view/format";
import { renderOffers } from "./render";
import { renderPopularItems, updateProductTypeOptions, updateFilterStates } from "./filters";
import { resolveDefaultViewMode } from "../../view-mode.js";
import { showTransientStatus } from "../../status-toast.js";

function shareUrlForOffer(offerId: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("offer", offerId);
  return url.toString();
}

export function setFavoritesView(active: boolean): void {
  appState.favoriteOnly = active;
  if (active) {
    navFavoritesLink.setAttribute("aria-current", "page");
    mobileNavFavoritesLink.setAttribute("aria-current", "page");
    mobileNavOffersLink.removeAttribute("aria-current");
  } else {
    navFavoritesLink.removeAttribute("aria-current");
    mobileNavFavoritesLink.removeAttribute("aria-current");
    mobileNavOffersLink.setAttribute("aria-current", "page");
  }
  renderOffers();
}

export function bindAppEvents(): void {
  grid.addEventListener("click", async (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-share-id]");
    const offer = appState.offers.find((item) => item.id === button?.dataset.shareId);
    if (!button || !offer) return;

    const url = shareUrlForOffer(offer.id);
    const title = `${offer.icon} ${offer.name} por ${money(offer.price)} · Feira Boa`;
    const text = `${offer.icon} ${offer.name} por ${money(offer.price)} no ${offer.store}. Confira a oferta:`;
    const shareMessage = `${text}\n${url}`;
    button.disabled = true;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        showTransientStatus(shareStatus, "Oferta compartilhada.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareMessage);
        showTransientStatus(shareStatus, "Mensagem da oferta copiada.");
      } else {
        window.prompt("Copie a mensagem para compartilhar esta oferta:", shareMessage);
        showTransientStatus(shareStatus, "Mensagem da oferta pronta para copiar.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showTransientStatus(shareStatus, "Não foi possível abrir o compartilhamento. Tente novamente.");
    } finally {
      button.disabled = false;
    }
  });

  grid.addEventListener("click", async (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-reaction]");
    const offerId = button?.dataset.offerId;
    const reaction = button?.dataset.reaction;
    if (!button || !offerId || (reaction !== "like" && reaction !== "dislike")) return;
    if (!appState.offers.some((offer) => offer.id === offerId)) return;

    if (!appState.currentUserId) {
      askForLogin(button, "reaction");
      return;
    }

    button.disabled = true;
    try {
      const reactions = await loadReactionsApi();
      const previousReaction = appState.userReactions.get(offerId);
      const counts = { ...(appState.reactionCounts.get(offerId) ?? { likes: 0, dislikes: 0 }) };

      if (previousReaction === reaction) {
        await reactions.deleteOfferReaction(appState.currentUserId, offerId);
        appState.userReactions.delete(offerId);
        counts[reaction === "like" ? "likes" : "dislikes"] = Math.max(0, counts[reaction === "like" ? "likes" : "dislikes"] - 1);
        appState.reactionCounts.set(offerId, counts);
        showTransientStatus(shareStatus, "Sua avaliação foi removida.");
      } else {
        await reactions.saveOfferReaction(appState.currentUserId, offerId, reaction);
        appState.userReactions.set(offerId, reaction);
        if (previousReaction && previousReaction !== reaction) {
          counts[previousReaction === "like" ? "likes" : "dislikes"] = Math.max(0, counts[previousReaction === "like" ? "likes" : "dislikes"] - 1);
        }
        counts[reaction === "like" ? "likes" : "dislikes"] += 1;
        appState.reactionCounts.set(offerId, counts);
        showTransientStatus(shareStatus, "Sua avaliação foi salva.");
      }

      appState.reactionCounts = await reactions.loadOfferReactionCounts();
      renderOffers();
    } catch (error) {
      showTransientStatus(shareStatus, `Não foi possível salvar sua avaliação: ${errorMessage(error)}`);
    } finally {
      button.disabled = false;
    }
  });

  grid.addEventListener("click", (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-favorite-id]");
    const offerId = button?.dataset.favoriteId;
    if (!offerId) return;
    if (!appState.currentUserId) {
      askForLogin(button, "favorite");
      return;
    }
    if (appState.favoriteIds.has(offerId)) appState.favoriteIds.delete(offerId);
    else appState.favoriteIds.add(offerId);
    appState.preferences.favoriteOfferIds = [...appState.favoriteIds];
    renderOffers();
    void saveFavoriteChanges();
  });

  showAllOffersButton.addEventListener("click", () => {
    appState.sharedOfferId = null;
    const url = new URL(window.location.href);
    url.searchParams.delete("offer");
    window.history.replaceState({}, "", url);
    renderOffers();
  });

  storeFilters.addEventListener("click", (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-store]");
    if (!button || button.disabled) return;
    appState.activeStore = button.dataset.store ?? "Todas as lojas";
    updateFilterStates(storeFilters, "store", appState.activeStore);
    updateProductTypeOptions();
    renderPopularItems();
    renderOffers();
  });

  popularItems.addEventListener("click", (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const quickSort = target.closest<HTMLButtonElement>("[data-quick-sort]");
    if (quickSort) {
      sortSelect.value = quickSort.dataset.quickSort ?? "recommended";
      appState.activeDepartment = "";
      appState.activeProductType = "";
      updateFilterStates(filters, "department", appState.activeDepartment);
      updateProductTypeOptions();
      renderPopularItems();
      renderOffers();
      return;
    }
    const group = target.closest<HTMLButtonElement>("[data-group]");
    if (!group) return;
    appState.activeDepartment = group.dataset.group ?? "";
    appState.activeProductType = "";
    sortSelect.value = "recommended";
    updateFilterStates(filters, "department", appState.activeDepartment);
    updateProductTypeOptions();
    renderPopularItems();
    renderOffers();
    resultsTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  filters.addEventListener("click", (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-department]");
    if (!button || button.disabled) return;
    appState.activeDepartment = button.dataset.department ?? "";
    appState.activeProductType = "";
    updateFilterStates(filters, "department", appState.activeDepartment);
    updateProductTypeOptions();
    renderOffers();
  });

  let renderTimer: number | undefined;
  function scheduleRender(): void {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderOffers, 150);
  }

  input.addEventListener("input", scheduleRender);
  priceMin.addEventListener("input", scheduleRender);
  priceMax.addEventListener("input", scheduleRender);
  productTypeSelect.addEventListener("change", () => { appState.activeProductType = productTypeSelect.value; renderOffers(); });
  sortSelect.addEventListener("change", () => { renderPopularItems(); renderOffers(); });
  resetButton.addEventListener("click", () => {
    appState.activeStore = "Todas as lojas"; appState.activeDepartment = ""; appState.activeProductType = "";
    input.value = ""; priceMin.value = ""; priceMax.value = ""; sortSelect.value = "recommended";
    updateFilterStates(storeFilters, "store", appState.activeStore);
    updateFilterStates(filters, "department", appState.activeDepartment);
    updateProductTypeOptions();
    renderPopularItems();
    renderOffers();
    input.focus();
  });
  viewToggle.addEventListener("click", (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-view-mode]");
    if (button?.dataset.viewMode !== "grid" && button?.dataset.viewMode !== "list") return;
    if (mobileViewMedia.matches) {
      appState.viewMode = "list";
      persistViewMode(appState.viewMode);
      updateViewMode();
      return;
    }
    appState.viewMode = button.dataset.viewMode;
    persistViewMode(appState.viewMode);
    updateViewMode();
  });

  mobileViewMedia.addEventListener?.("change", () => {
    appState.viewMode = resolveDefaultViewMode(localStorage.getItem("feira-boa:view-mode:v1"), mobileViewMedia.matches);
    persistViewMode(appState.viewMode);
    updateViewMode();
  });
  for (const favoritesLink of [navFavoritesLink, mobileNavFavoritesLink]) {
    favoritesLink.addEventListener("click", (event: MouseEvent) => {
      if (appState.currentUserId) return;
      event.preventDefault();
      askForLogin(favoritesLink, "favorite");
    });
  }
  favoritesToggle.addEventListener("click", () => {
    if (!appState.currentUserId) {
      askForLogin(favoritesToggle, "favorite");
      return;
    }
    setFavoritesView(!appState.favoriteOnly);
  });
  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
    if (event.key === "/") {
      event.preventDefault();
      input.focus();
    }
  });
}
