import { ALL_SECTORS_LABEL, TAXONOMY_GROUPS } from "../catalog-taxonomy.mjs";
import { describeStoreFilterChip } from "../../scripts/domain/store-filter-chip.mjs";
import { appState } from "./state";
import { element } from "./elements";
import { filters, storeFilters, popularItems, priceMin, priceMax, productTypeSelect, sortSelect } from "./dom";
import { isActive, todayInSaoPaulo } from "../view/format";
import {
  PINNED_POPULAR_DEPARTMENT_IDS,
  RANDOM_POPULAR_DEPARTMENT_IDS,
} from "../../scripts/domain/popular-category-order.mjs";
import { buildDepartmentOfferCounts } from "../../scripts/domain/department-offer-counts.mjs";
import { QUICK_DEPARTMENT_CHIPS, PINNED_TAXONOMY_CHIP_LABELS } from "./quick-departments";
import { offerCategory, offerOrder, CATEGORY_ICONS, matchesSector } from "./offer-model";
import type { Offer } from "../types";

export function renderStoreFilters(): void {
  const today = todayInSaoPaulo();
  const counts = new Map<string, number>();
  let total = 0;
  for (const offer of appState.offers) {
    if (!isActive(offer, today)) continue;
    total += 1;
    counts.set(offer.store, (counts.get(offer.store) ?? 0) + 1);
  }
  const ordered = [...appState.storeNames].sort((a, b) => {
    if (a === "Todas as lojas") return -1;
    if (b === "Todas as lojas") return 1;
    return (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
  });
  storeFilters.replaceChildren(...ordered.map((store) => {
    const count = store === "Todas as lojas" ? total : (counts.get(store) ?? 0);
    const disabled = store !== "Todas as lojas" && count === 0;
    const chip = describeStoreFilterChip(store, count);
    const button = element(
      "button",
      `filter store-filter-chip${store === "Todas as lojas" ? " store-filter-chip--all" : ""}${store === appState.activeStore ? " active" : ""}${chip.logoSrc ? " has-store-logo" : ""}${chip.markClass ? ` ${chip.markClass}` : ""}`,
    );
    button.type = "button";
    button.dataset.store = store;
    button.disabled = disabled;
    button.setAttribute("aria-pressed", String(store === appState.activeStore));
    button.setAttribute("aria-label", chip.ariaLabel);
    if (disabled) button.title = "Sem ofertas ativas hoje";

    const countBadge = element("span", "store-filter-chip-count", String(count));
    countBadge.setAttribute("aria-hidden", "true");

    if (chip.logoSrc) {
      const logo = element("span", "store-filter-chip-logo");
      const fallback = element("span", "store-filter-chip-fallback", chip.fallback);
      fallback.setAttribute("aria-hidden", "true");
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = chip.logoSrc;
      img.addEventListener("error", () => {
        logo.classList.remove("has-logo");
      }, { once: true });
      img.addEventListener("load", () => {
        if (img.naturalWidth > 0) logo.classList.add("has-logo");
      }, { once: true });
      logo.append(fallback, img);
      button.append(logo, element("span", "store-filter-chip-label", chip.label), countBadge);
    } else {
      const icon = element("span", "store-filter-chip-all-icon", "🏬");
      icon.setAttribute("aria-hidden", "true");
      button.append(icon, element("span", "store-filter-chip-label", chip.label), countBadge);
    }
    return button;
  }));
}

export function renderPopularItems(): void {
  const today = todayInSaoPaulo();
  const activeOffers = appState.offers.filter((offer) => isActive(offer, today));
  const departmentCounts = buildDepartmentOfferCounts(activeOffers, (offer: Offer) => offerCategory(offer));
  const quickSorts = [
    { id: "top-rated", label: "Mais curtidos", icon: "👍" },
    { id: "discount", label: "Maiores descontos", icon: "🏷️" },
  ];
  const departmentChip = (id: string, pinned: boolean): { id: string; label: string; icon: string; pinned: boolean } => {
    const synthetic = QUICK_DEPARTMENT_CHIPS[id];
    if (synthetic) {
      return { id, label: synthetic.label, icon: synthetic.icon, pinned };
    }
    const group = TAXONOMY_GROUPS.find((item) => item.id === id)!;
    const label = pinned ? (PINNED_TAXONOMY_CHIP_LABELS[id] ?? group.label) : group.label;
    return { id, label, icon: CATEGORY_ICONS[id] ?? "🛒", pinned };
  };
  const pinnedDepartments = PINNED_POPULAR_DEPARTMENT_IDS.map((id) => departmentChip(id, true));
  const randomDepartments = RANDOM_POPULAR_DEPARTMENT_IDS
    .filter((id) => (departmentCounts.get(id) ?? 0) > 0)
    .map((id) => departmentChip(id, false));
  popularItems.replaceChildren(...quickSorts.map(({ id, label, icon }) => {
    const button = element("button", `popular-item quick-sort${sortSelect.value === id ? " active" : ""}`);
    button.type = "button";
    button.dataset.quickSort = id;
    button.setAttribute("aria-label", `Mostrar somente ${label.toLowerCase()}`);
    button.setAttribute("aria-pressed", String(sortSelect.value === id));
    const iconNode = element("span", "", icon);
    iconNode.setAttribute("aria-hidden", "true");
    button.append(iconNode, element("small", "", label));
    return button;
  }), ...[...pinnedDepartments, ...randomDepartments].map(({ id, label, icon, pinned }) => {
    const button = element(
      "button",
      `popular-item${pinned ? " popular-item--pinned" : ""}${appState.activeDepartment === id ? " active" : ""}`,
    );
    button.type = "button";
    button.dataset.group = id;
    button.setAttribute("aria-label", `Ver ${label}`);
    button.setAttribute("aria-pressed", String(appState.activeDepartment === id));
    const iconNode = element("span", "", icon);
    iconNode.setAttribute("aria-hidden", "true");
    button.append(iconNode, element("small", "", label));
    return button;
  }));
}



export function updateProductTypeOptions(): void {
  const today = todayInSaoPaulo();
  const options = new Map<string, number>();
  for (const offer of appState.offers) {
    if (!isActive(offer, today)) continue;
    if (appState.activeStore !== "Todas as lojas" && offer.store !== appState.activeStore) continue;
    const category = offerCategory(offer);
    if (!matchesSector(offer)) continue;
    if (!options.has(category.subcategory)) options.set(category.subcategory, offerOrder(offer));
  }
  const types = [...options.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "pt-BR")).map(([type]) => type);
  if (!types.includes(appState.activeProductType)) appState.activeProductType = "";
  productTypeSelect.replaceChildren(
    new Option("Todos os tipos", ""),
    ...types.map((type) => new Option(type, type)),
  );
  productTypeSelect.value = appState.activeProductType;
}

export function renderFilters(): void {
  const today = todayInSaoPaulo();
  const counts = new Map<string, number>();
  for (const offer of appState.offers) {
    if (!isActive(offer, today)) continue;
    const groupId = offerCategory(offer).groupId;
    counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
  }
  const sectors = [{ id: "", label: ALL_SECTORS_LABEL, count: appState.offers.filter((offer) => isActive(offer, today)).length }, ...TAXONOMY_GROUPS.map((group) => ({ id: group.id, label: group.label, count: counts.get(group.id) ?? 0 }))];
  filters.replaceChildren(...sectors.map((sector) => {
    const disabled = sector.id !== "" && sector.count === 0;
    const button = element("button", `filter${sector.id === appState.activeDepartment ? " active" : ""}`, sector.label);
    button.type = "button";
    button.dataset.department = sector.id;
    button.disabled = disabled;
    button.setAttribute("aria-pressed", String(sector.id === appState.activeDepartment));
    if (disabled) button.title = "Sem ofertas ativas hoje";
    return button;
  }));
  updateProductTypeOptions();
}

export function updateFilterStates(container: HTMLElement, key: "store" | "department", value: string): void {
  container.querySelectorAll<HTMLButtonElement>(`[data-${key}]`).forEach((button) => {
    const selected = button.dataset[key] === value;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

export function getPriceBounds(): { min: number | null; max: number | null } {
  const min = priceMin.value.trim() ? Number(priceMin.value.replace(",", ".")) : null;
  const max = priceMax.value.trim() ? Number(priceMax.value.replace(",", ".")) : null;
  return { min: min !== null && Number.isFinite(min) ? min : null, max: max !== null && Number.isFinite(max) ? max : null };
}
