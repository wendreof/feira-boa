import { ALL_SECTORS_LABEL, TAXONOMY_GROUPS } from "../catalog-taxonomy.mjs";
import { appState } from "./state";
import { element } from "./elements";
import { filters, storeFilters, popularItems, priceMin, priceMax, productTypeSelect, sortSelect } from "./dom";
import { isActive, todayInSaoPaulo } from "../view/format";
import { offerCategory, offerOrder, CATEGORY_ICONS, RANDOM_CATEGORY_ORDER, matchesSector } from "./offer-model";

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
    const button = element("button", `filter${store === appState.activeStore ? " active" : ""}`, `${store} · ${count}`);
    button.type = "button";
    button.dataset.store = store;
    button.disabled = disabled;
    button.setAttribute("aria-pressed", String(store === appState.activeStore));
    if (disabled) button.title = "Sem ofertas ativas hoje";
    return button;
  }));
}

export function renderPopularItems(): void {
  const today = todayInSaoPaulo();
  const counts = new Map<string, number>();
  for (const offer of appState.offers) {
    if (!isActive(offer, today)) continue;
    const category = offerCategory(offer);
    const key = category.subcategory;
    counts.set(category.groupId, (counts.get(category.groupId) ?? 0) + 1);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const quickSorts = [
    { id: "top-rated", label: "Mais curtidos", icon: "👍" },
    { id: "discount", label: "Maiores descontos", icon: "🏷️" },
  ];
  const featured: Array<{ id: string; label: string; icon: string }> = [
    { id: "carnes", label: "Carnes", icon: "🥩" },
    { id: "bebidas", label: "Bebidas", icon: "🥤" },
  ];
  const rest = RANDOM_CATEGORY_ORDER
    .filter((groupId) => groupId !== "bebidas" && groupId !== "outros" && (counts.get(groupId) ?? 0) > 0)
    .map((groupId) => {
      const group = TAXONOMY_GROUPS.find((item) => item.id === groupId)!;
      return { id: group.id, label: group.label, icon: CATEGORY_ICONS[group.id] ?? "🛒" };
    });
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
  }), ...[...featured, ...rest].map(({ id, label, icon }) => {
    const button = element("button", `popular-item${appState.activeDepartment === id ? " active" : ""}`);
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
    if (!matchesSector(category)) continue;
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
    const button = element("button", `filter${sector.id === appState.activeDepartment ? " active" : ""}`, `${sector.label} · ${sector.count}`);
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
