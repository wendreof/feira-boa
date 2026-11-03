import { categoryLabel, categoryOrder } from "../catalog-taxonomy.mjs";
import { matchesCarnesDepartment } from "../../scripts/domain/carnes-department.mjs";
import { matchesFriosEmbutidosDepartment, FRIOS_EMBUTIDOS_DEPARTMENT_ID } from "../../scripts/domain/frios-department.mjs";
import { buildOfferSearchDocument, matchesOfferSearch } from "../../scripts/domain/offer-search.mjs";
import { appState } from "./state";
import { type Offer } from "../types";
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
  const category = offerCategory(offer);
  const document = buildOfferSearchDocument(offer, {
    subcategory: category.subcategory,
    groupLabel: categoryLabel(category),
  });
  return matchesOfferSearch(query, document);
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
