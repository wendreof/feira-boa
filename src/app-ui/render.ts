import { QUICK_DEPARTMENT_LABELS } from "./quick-departments";
import { TAXONOMY_GROUPS, discountRatio } from "../catalog-taxonomy.mjs";
import { appState } from "./state";
import { createOfferCard, updateOfferCard } from "./card";
import {
  feedStatus, feedRetry, resultsAnnouncement, grid, input, sortSelect, emptyState, storesDirectoryLink,
  resultsSubtitle, resultsTitle, resultsScopeBar, resultsScopeCount, resultsScopeFlash, resultsScopeStore,
  showAllOffersButton, emptyHelp, favoritesToggle, activeFilterCount,
  archiveSection, archiveSubtitle, archiveGrid, clearActiveFiltersButton,
} from "./dom";
import { getPriceBounds } from "./filters";
import { money, isActive, todayInSaoPaulo, dateLabel } from "../view/format";
import { offerCategory, randomOfferRank, matchesSearch, matchesSector } from "./offer-model";
import type { Offer } from "../types";
import { refreshAlertsInvitePanel } from "./alerts-invite";
import { browseFiltersActive } from "./browse-filters";
import { storeNameFromSearch } from "../../scripts/domain/store-search-label.mjs";
import { hideOfferGridLoading } from "./offer-grid-loading";
import { bindIncrementalMountGrid, mountOffersIncrementally } from "./incremental-mount";
import {
  partitionOfferCardCache,
  shouldRemountOffersSynchronously,
} from "../../scripts/domain/offer-card-cache.mjs";

let offerMountGeneration = 0;

bindIncrementalMountGrid(grid);

export type RenderOffersOptions = {
  onFirstBatch?: () => void;
};

function likesByOffer(): Map<string, number> {
  return new Map([...appState.reactionCounts].map(([offerId, counts]) => [offerId, counts.likes]));
}

function matchesArchivedFilters(offer: Offer, today: string, min: number | null, max: number | null): boolean {
  const category = offerCategory(offer);
  return (appState.activeStore === "Todas as lojas" || offer.store === appState.activeStore)
    && matchesSector(offer)
    && (!appState.activeProductType || category.subcategory === appState.activeProductType)
    && (min === null || offer.price >= min)
    && (max === null || offer.price <= max)
    && matchesSearch(offer, input.value)
    && offer.validTo < today;
}

function renderArchivedOffers(today: string, min: number | null, max: number | null): void {
  const hideArchive = Boolean(appState.sharedOfferId) || appState.favoriteOnly || sortSelect.value === "top-rated";
  if (hideArchive) {
    archiveSection.hidden = true;
    archiveGrid.replaceChildren();
    for (const [id, card] of appState.archivedCards) {
      card.root.remove();
      appState.archivedCards.delete(id);
    }
    return;
  }

  const matching = appState.archivedCampaigns.flatMap((campaign) => campaign.offers.filter((offer) => matchesArchivedFilters(offer, today, min, max)));
  if (matching.length === 0) {
    archiveSection.hidden = true;
    archiveGrid.replaceChildren();
    for (const [id, card] of appState.archivedCards) {
      card.root.remove();
      appState.archivedCards.delete(id);
    }
    return;
  }

  archiveSection.hidden = false;
  const storeNames = [...new Set(matching.map((offer) => offer.store))];
  const periodHints = appState.archivedCampaigns
    .filter((campaign) => matching.some((offer) => offer.store === campaign.store.name))
    .map((campaign) => `${campaign.store.name} · até ${dateLabel(campaign.store.to)}`);
  archiveSubtitle.textContent = `${matching.length} ${matching.length === 1 ? "oferta encerrada" : "ofertas encerradas"}${storeNames.length === 1 ? "" : ` · ${storeNames.length} lojas`}${periodHints.length === 1 ? ` · ${periodHints[0]}` : ""}`;

  const matchingIds = new Set(matching.map((offer) => offer.id));
  const liveArchivedIds = new Set(
    appState.archivedCampaigns.flatMap((campaign) => campaign.offers.map((offer) => offer.id)),
  );
  const archivedCachePlan = partitionOfferCardCache({
    cachedIds: appState.archivedCards.keys(),
    matchingIds,
    liveOfferIds: liveArchivedIds,
  });
  for (const id of archivedCachePlan.evict) {
    const card = appState.archivedCards.get(id);
    if (!card) continue;
    card.root.remove();
    appState.archivedCards.delete(id);
  }
  for (const id of archivedCachePlan.detach) {
    const card = appState.archivedCards.get(id);
    if (card?.root.isConnected) card.root.remove();
  }
  for (const offer of matching) {
    let card = appState.archivedCards.get(offer.id);
    if (!card) {
      card = createOfferCard(offer, { archived: true });
      appState.archivedCards.set(offer.id, card);
    }
    updateOfferCard(card, offer);
    archiveGrid.append(card.root);
  }
}

function mountMatchingOffer(offer: Offer): void {
  let card = appState.cards.get(offer.id);
  if (!card) {
    card = createOfferCard(offer);
    appState.cards.set(offer.id, card);
  }
  updateOfferCard(card, offer);
  grid.append(card.root);
}

function finishOffersUi(
  matching: Offer[],
  focused: HTMLElement | null,
  today: string,
  priceRangeReversed: boolean,
  min: number | null,
  max: number | null,
): void {
  if (matching.length === 0) grid.replaceChildren();
  if (focused?.isConnected) focused.focus({ preventScroll: true });

  renderArchivedOffers(today, priceRangeReversed ? null : min, priceRangeReversed ? null : max);

  feedStatus.hidden = true;
  feedRetry.hidden = true;
  emptyState.hidden = matching.length > 0;
  storesDirectoryLink.hidden = matching.length === 0;
  const activeFavoriteCount = appState.offers.filter((offer) => isActive(offer, today) && appState.favoriteIds.has(offer.id)).length;
  favoritesToggle.textContent = appState.favoriteOnly ? `Ver todas (${activeFavoriteCount})` : `Favoritos (${activeFavoriteCount})`;
  favoritesToggle.setAttribute("aria-pressed", String(appState.favoriteOnly));
  const searchStore = storeNameFromSearch(appState.storeNames, input.value);
  const filteredStore = appState.activeStore !== "Todas as lojas"
    ? appState.activeStore
    : searchStore;
  resultsTitle.textContent = appState.sharedOfferId
    ? "Oferta compartilhada"
    : filteredStore
      ? `Ofertas em ${filteredStore}`
      : "Ofertas encontradas";
  showAllOffersButton.hidden = !appState.sharedOfferId;
  const storeLabel = filteredStore ?? "todas as lojas";
  const sectorLabel = appState.activeDepartment
    ? (QUICK_DEPARTMENT_LABELS[appState.activeDepartment]
      ?? TAXONOMY_GROUPS.find((group) => group.id === appState.activeDepartment)?.label
      ?? "")
    : "";
  const sharedOffer = appState.sharedOfferId ? matching[0] : null;
  resultsSubtitle.textContent = sharedOffer
    ? `${sharedOffer.name} · ${money(sharedOffer.price)} · ${sharedOffer.store}${isActive(sharedOffer, today) ? "" : " · oferta encerrada"}`
    : `${matching.length} ${matching.length === 1 ? "oferta ativa" : "ofertas ativas"} · ${storeLabel}${sectorLabel ? ` · ${sectorLabel}` : ""}${appState.activeProductType ? ` · ${appState.activeProductType}` : ""}`;
  clearActiveFiltersButton.hidden = Boolean(appState.sharedOfferId) || !browseFiltersActive();
  if (priceRangeReversed) emptyHelp.textContent = "O preço mínimo precisa ser menor ou igual ao preço máximo.";
  else if (appState.offers.some((offer) => isActive(offer, today))) emptyHelp.textContent = "Não encontramos ofertas com essa busca e esses filtros. Tente outra palavra ou limpe os filtros.";
  else emptyHelp.textContent = "Não há ofertas ativas hoje. Consulte os folhetos abaixo para ver as promoções mais recentes.";
  const announcement = filteredStore
    ? `${matching.length} ${matching.length === 1 ? "oferta" : "ofertas"} em ${filteredStore}`
    : `${matching.length} ${matching.length === 1 ? "oferta encontrada" : "ofertas encontradas"}`;
  if (resultsAnnouncement.textContent !== announcement) {
    resultsAnnouncement.textContent = "";
    window.requestAnimationFrame(() => { resultsAnnouncement.textContent = announcement; });
  }
  if (filteredStore && !appState.sharedOfferId) {
    resultsScopeBar.hidden = false;
    resultsScopeStore.textContent = filteredStore;
    resultsScopeCount.textContent = matching.length === 1 ? "1 oferta" : `${matching.length} ofertas`;
  } else {
    resultsScopeBar.hidden = true;
    resultsScopeFlash.hidden = true;
    resultsScopeBar.classList.remove("results-scope-bar--fresh");
  }
  refreshAlertsInvitePanel();
}

export function renderOffers(options?: RenderOffersOptions): void {
  hideOfferGridLoading();
  const generation = ++offerMountGeneration;
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
    const matchesSectorFilter = matchesSector(offer);
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
  const liveOfferIds = new Set(appState.offers.map((offer) => offer.id));
  const cardCachePlan = partitionOfferCardCache({
    cachedIds: appState.cards.keys(),
    matchingIds,
    liveOfferIds,
  });
  for (const id of cardCachePlan.evict) {
    const card = appState.cards.get(id);
    if (!card) continue;
    card.root.remove();
    appState.cards.delete(id);
  }
  for (const id of cardCachePlan.detach) {
    const card = appState.cards.get(id);
    if (card?.root.isConnected) card.root.remove();
  }
  const finish = (): void => {
    if (generation !== offerMountGeneration) return;
    finishOffersUi(matching, focused, today, priceRangeReversed, min, max);
  };

  if (shouldRemountOffersSynchronously(matching.map((offer) => offer.id), appState.cards)) {
    for (const offer of matching) mountMatchingOffer(offer);
    finish();
    return;
  }

  void mountOffersIncrementally(
    matching,
    mountMatchingOffer,
    generation,
    () => offerMountGeneration,
    options?.onFirstBatch,
  ).then(finish);
}
