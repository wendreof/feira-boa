import { TAXONOMY_GROUPS, categoryLabel, categoryOrder } from "../catalog-taxonomy.mjs";
import { appState } from "./state";
import { normalizeSearch } from "../view/format";
import { type Offer } from "../types";

const searchEquivalents: Record<string, string[]> = { iogurte: ["iog"], higienico: ["hig"], higienica: ["hig"] };
export function offerCategory(offer: Offer): { groupId: string; subcategory: string } {
  return appState.categories.get(offer.id) ?? { groupId: "outros", subcategory: "Outros" };
}
export function offerOrder(offer: Offer): number {
  const [groupIndex, subIndex] = categoryOrder(offerCategory(offer));
  return groupIndex * 100 + subIndex;
}
export const CATEGORY_ICONS: Record<string, string> = {
  frescos: "🥬", mercearia: "🥫", bebidas: "🥤", bebidas_alcoolicas: "🍺", congelados: "🧊", saudaveis: "🥗", limpeza: "🧺",
  higiene: "🧴", infantil: "🍼", pet: "🐾", casa: "🏠", churrasco: "🔥", vestuario: "👕", outros: "🏷️",
};
const CARNES_SUBCATEGORIES = new Set(["Açougue e carnes frescas", "Aves", "Peixaria e frutos do mar", "Frios e embutidos"]);
export const RANDOM_CATEGORY_ORDER = [...TAXONOMY_GROUPS].sort(() => Math.random() - 0.5).map((group) => group.id);

export function matchesSearch(offer: Offer, query: string): boolean {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const category = offerCategory(offer);
  const searchable = normalizeSearch([offer.name, offer.detail, offer.category, offer.department, ...offer.productTypes, category.subcategory, categoryLabel(category), offer.store, offer.branch, offer.note, offer.notice ?? ""].join(" "));
  const words = searchable.split(" ");
  return terms.every((term) => {
    const variants = [term, ...(searchEquivalents[term] || [])];
    return variants.some((variant) => searchable.includes(variant) || words.some((word) => word.startsWith(variant)));
  });
}

export function matchesSector(category: { groupId: string; subcategory: string }): boolean {
  if (!appState.activeDepartment) return true;
  if (appState.activeDepartment === "carnes") return CARNES_SUBCATEGORIES.has(category.subcategory);
  return category.groupId === appState.activeDepartment;
}
