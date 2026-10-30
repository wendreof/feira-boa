import { TAXONOMY_GROUPS, discountRatio } from "../catalog-taxonomy.mjs";
import { appState } from "./state";
import { createOfferCard, updateOfferCard } from "./card";
import { feedStatus, feedRetry, resultsAnnouncement, grid, input, sortSelect, emptyState, storesDirectoryLink, resultsSubtitle, resultsTitle, showAllOffersButton, emptyHelp, favoritesToggle, activeFilterCount } from "./dom";
import { getPriceBounds } from "./filters";
import { money, isActive, todayInSaoPaulo } from "../view/format";
import { offerCategory, randomOfferRank, matchesSearch, matchesSector } from "./offer-model";

function likesByOffer(): Map<string, number> {
  return new Map([...appState.reactionCounts].map(([offerId, counts]) => [offerId, counts.likes]));
}

export function renderOffers(): void {
  const focused = document.activeElement instanceof HTMLElement && grid.contains(document.activeElement)
    ? document.activeElement
    : null;
  const today = todayInSaoPaulo();
  const { min, max } = getPriceBounds();
  const activeCount = Number(appState.activeStore !== "Todas as lojas") + Number(Boolean(appState.activeDepartment)) + Number(Boolean(appState.activeProductType)) + Number(min !== null || max !== null);
  activeFilterCount.hidden = activeCount === 0;
  activeFilterCount.textContent = String(activeCount);
  const priceRangeReversed = min !== null && max !== null && min > max;
  const likes = likesByOffer();
  let matching = priceRangeReversed ? [] : appState.offers.filter((offer) => {
    const category = offerCategory(offer);
    const matchesSectorFilter = matchesSector(category);
    const matchesReaction = sortSelect.value === "top-rated" ? (likes.get(offer.id) ?? 0) > 0 : true;
    const matchesDiscount = sortSelect.value === "discount" ? discountRatio(offer) > 0 : true;
    return (appState.sharedOfferId ? offer.id === appState.sharedOfferId : isActive(offer, today)) && (appState.sharedOfferId || appState.activeStore === "Todas as lojas" || offer.store === appState.activeStore) &&
    (appState.sharedOfferId || matchesSectorFilter) &&
    (appState.sharedOfferId || !appState.activeProductType || category.subcategory === appState.activeProductType) &&
    (appState.sharedOfferId || !appState.favoriteOnly || appState.favoriteIds.has(offer.id)) &&
    (appState.sharedOfferId || matchesReaction) && (appState.sharedOfferId || matchesDiscount) &&
    (appState.sharedOfferId || min === null || offer.price >= min) && (appState.sharedOfferId || max === null || offer.price <= max) && (appState.sharedOfferId || matchesSearch(offer, input.value));
  });
  if (sortSelect.value === "recommended") matching = [...matching].sort((a, b) => randomOfferRank(a) - randomOfferRank(b));
  if (sortSelect.value === "price-low") matching = [...matching].sort((a, b) => a.price - b.price);
  if (sortSelect.value === "price-high") matching = [...matching].sort((a, b) => b.price - a.price);
  if (sortSelect.value === "discount") matching = [...matching].sort((a, b) => discountRatio(b) - discountRatio(a));
  if (sortSelect.value === "top-rated") {
    matching = [...matching].sort((a, b) => (likes.get(b.id) ?? 0) - (likes.get(a.id) ?? 0));
  }

  const matchingIds = new Set(matching.map((offer) => offer.id));
  for (const [id, card] of appState.cards) {
    if (!matchingIds.has(id)) {
      card.root.remove();
      appState.cards.delete(id);
    }
  }
  for (const offer of matching) {
    let card = appState.cards.get(offer.id);
    if (!card) {
      card = createOfferCard(offer);
      appState.cards.set(offer.id, card);
    }
    updateOfferCard(card, offer);
    grid.append(card.root);
  }
  if (matching.length === 0) grid.replaceChildren();
  if (focused?.isConnected) focused.focus({ preventScroll: true });

  feedStatus.hidden = true;
  feedRetry.hidden = true;
  emptyState.hidden = matching.length > 0;
  storesDirectoryLink.hidden = matching.length === 0;
  const activeFavoriteCount = appState.offers.filter((offer) => isActive(offer, today) && appState.favoriteIds.has(offer.id)).length;
  favoritesToggle.textContent = appState.favoriteOnly ? `Ver todas (${activeFavoriteCount})` : `Favoritos (${activeFavoriteCount})`;
  favoritesToggle.setAttribute("aria-pressed", String(appState.favoriteOnly));
  resultsTitle.textContent = appState.sharedOfferId ? "Oferta compartilhada" : "Ofertas encontradas";
  showAllOffersButton.hidden = !appState.sharedOfferId;
  const storeLabel = appState.activeStore === "Todas as lojas" ? "todas as lojas" : appState.activeStore;
  const sectorLabel = appState.activeDepartment ? TAXONOMY_GROUPS.find((group) => group.id === appState.activeDepartment)?.label ?? "" : "";
  const sharedOffer = appState.sharedOfferId ? matching[0] : null;
  resultsSubtitle.textContent = sharedOffer
    ? `${sharedOffer.name} · ${money(sharedOffer.price)} · ${sharedOffer.store}${isActive(sharedOffer, today) ? "" : " · oferta encerrada"}`
    : `${matching.length} ${matching.length === 1 ? "oferta ativa" : "ofertas ativas"} · ${storeLabel}${sectorLabel ? ` · ${sectorLabel}` : ""}${appState.activeProductType ? ` · ${appState.activeProductType}` : ""}`;
  if (priceRangeReversed) emptyHelp.textContent = "O preço mínimo precisa ser menor ou igual ao preço máximo.";
  else if (appState.offers.some((offer) => isActive(offer, today))) emptyHelp.textContent = "Não encontramos ofertas com essa busca e esses filtros. Tente outra palavra ou limpe os filtros.";
  else emptyHelp.textContent = "Não há ofertas ativas hoje. Consulte os folhetos abaixo para ver as promoções mais recentes.";
  const announcement = `${matching.length} ${matching.length === 1 ? "oferta encontrada" : "ofertas encontradas"}`;
  if (resultsAnnouncement.textContent !== announcement) {
    resultsAnnouncement.textContent = "";
    window.requestAnimationFrame(() => { resultsAnnouncement.textContent = announcement; });
  }
}
