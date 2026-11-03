import { matchesCarnesDepartment } from "./carnes-department.mjs";

/**
 * @param {{ store?: string }} offer
 * @param {{ subcategory?: string }} category
 * @param {{ activeDepartment?: string }} context
 */
export function offerCardCategoryLine(offer, category, context = {}) {
  const store = String(offer.store ?? "").trim();
  if (
    (context.activeDepartment === "carnes" || category.subcategory === "Carnes para churrasco")
    && matchesCarnesDepartment(offer)
  ) {
    return store ? `Açougue · kg · ${store}` : "Açougue · kg";
  }
  return [category.subcategory, store].filter(Boolean).join(" · ");
}
