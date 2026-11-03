import { categoryLabel, categoryOrder } from "../catalog-taxonomy.mjs";
import { matchesCarnesDepartment } from "../../scripts/domain/carnes-department.mjs";
import { matchesFriosEmbutidosDepartment, FRIOS_EMBUTIDOS_DEPARTMENT_ID } from "../../scripts/domain/frios-department.mjs";
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
// Ordem aleatoria da lista "Recomendadas": sorteada uma vez por abertura da pagina,
// assim a ordem muda a cada visita mas nao embaralha de novo a cada filtro.
const randomRanks = new Map<string, number>();
export function randomOfferRank(offer: Offer): number {
  let rank = randomRanks.get(offer.id);
  if (rank === undefined) {
    rank = Math.random();
    randomRanks.set(offer.id, rank);
  }
  return rank;
}
export const CATEGORY_ICONS: Record<string, string> = {
  frescos: "🥬", mercearia: "🥫", bebidas: "🥤", bebidas_alcoolicas: "🍺", congelados: "🧊", saudaveis: "🥗", limpeza: "🧺",
  higiene: "🧴", infantil: "🍼", pet: "🐾", casa: "🏠", churrasco: "🔥", vestuario: "👕", outros: "🏷️",
};

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

export function matchesSector(offer: Offer): boolean {
  const category = offerCategory(offer);
  if (!appState.activeDepartment) return true;
  if (appState.activeDepartment === "carnes") return matchesCarnesDepartment(offer);
  if (appState.activeDepartment === FRIOS_EMBUTIDOS_DEPARTMENT_ID) {
    return matchesFriosEmbutidosDepartment(category);
  }
  return category.groupId === appState.activeDepartment;
}
