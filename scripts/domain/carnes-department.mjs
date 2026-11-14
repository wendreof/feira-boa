import { foldText } from "../../src/shared/text.mjs";

/** Counter meat/fish types under the home "Carnes" quick filter (kg-priced only). */
export const CARNES_COUNTER_PRODUCT_TYPES = new Set(["Carne bovina", "Carnes suínas", "Peixes", "Frango"]);

/** Pet food sold by kg must not use the açougue counter line or carnes filter. */
const PET_FOOD_NAME = /\b(racao|racoes|petisco|petiscos|alimento para|para caes|para gatos|areia sanit|yuppie)\b/;

/**
 * @param {string} [name]
 */
export function isPetFoodOfferName(name) {
  return PET_FOOD_NAME.test(foldText(name ?? ""));
}

/**
 * True when the offer unit is kilogram pricing (açougue), not fixed grams/units.
 * @param {string} detail
 */
export function isSoldByKilogram(detail) {
  const compact = String(detail ?? "").replace(/\s+/g, "").toLowerCase().replace(",", ".");
  if (!compact) return false;
  if (compact === "kg") return true;
  return /^\d+(?:\.\d+)?kg$/.test(compact);
}

/**
 * @param {{ name?: string, productType?: string, productTypes?: string[], detail?: string }} offer
 */
export function matchesCarnesDepartment(offer) {
  if (isPetFoodOfferName(offer?.name)) return false;
  const primary = String(offer.productType ?? "");
  const types = offer.productTypes ?? [];
  const isCounterCut =
    CARNES_COUNTER_PRODUCT_TYPES.has(primary)
    || types.some((type) => CARNES_COUNTER_PRODUCT_TYPES.has(type));
  if (!isCounterCut) return false;
  return isSoldByKilogram(offer.detail);
}

/** Feed QA: counter types that will not appear under Açougue (kg). */
export function counterCutDetailHints(offer) {
  const primary = String(offer?.productType ?? "");
  const types = offer?.productTypes ?? [];
  const isCounter =
    CARNES_COUNTER_PRODUCT_TYPES.has(primary)
    || types.some((type) => CARNES_COUNTER_PRODUCT_TYPES.has(type));
  if (!isCounter || isSoldByKilogram(offer?.detail)) return [];
  const id = offer?.id ?? "unknown";
  const name = offer?.name ?? "";
  const detail = offer?.detail ?? "";
  return [`${id} (${name}): tipo de açougue/peixe mas unidade "${detail}" — fora do filtro Açougue (kg)`];
}
