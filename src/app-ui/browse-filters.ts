import { appState } from "./state";
import { input, priceMin, priceMax, productTypeSelect, sortSelect, storeFilters, filters, popularItems, navFavoritesLink, mobileNavFavoritesLink, mobileNavOffersLink } from "./dom";
import { renderPopularItems, updateProductTypeOptions, updateFilterStates } from "./filters";
import { renderOffers } from "./render";
import { saveActiveDepartment } from "./session-filters";
import { refreshSearchSuggest } from "./search-suggest";

export function browseFiltersActive(): boolean {
  const { min, max } = (() => {
    const minRaw = priceMin.value.trim();
    const maxRaw = priceMax.value.trim();
    const min = minRaw ? Number(minRaw) : null;
    const max = maxRaw ? Number(maxRaw) : null;
    return { min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null };
  })();
  return Boolean(
    input.value.trim()
    || appState.activeDepartment
    || appState.activeProductType
    || appState.activeStore !== "Todas as lojas"
    || appState.favoriteOnly
    || sortSelect.value !== "recommended"
    || min !== null
    || max !== null,
  );
}

export function clearBrowseFilters(): void {
  appState.activeStore = "Todas as lojas";
  appState.activeDepartment = "";
  appState.activeProductType = "";
  appState.favoriteOnly = false;
  navFavoritesLink.removeAttribute("aria-current");
  mobileNavFavoritesLink.removeAttribute("aria-current");
  mobileNavOffersLink.setAttribute("aria-current", "page");
  input.value = "";
  priceMin.value = "";
  priceMax.value = "";
  sortSelect.value = "recommended";
  saveActiveDepartment("");
  updateFilterStates(storeFilters, "store", appState.activeStore);
  updateFilterStates(filters, "department", appState.activeDepartment);
  updateProductTypeOptions();
  renderPopularItems();
  renderOffers();
  refreshSearchSuggest();
}
