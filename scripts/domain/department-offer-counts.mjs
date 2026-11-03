import { matchesCarnesDepartment } from "./carnes-department.mjs";
import { FRIOS_EMBUTIDOS_DEPARTMENT_ID, matchesFriosEmbutidosDepartment } from "./frios-department.mjs";
import {
  PINNED_POPULAR_DEPARTMENT_IDS,
  RANDOM_POPULAR_DEPARTMENT_IDS,
} from "./popular-category-order.mjs";

/**
 * @param {string} departmentId
 * @param {{ productType?: string, productTypes?: string[], detail?: string }} offer
 * @param {{ groupId?: string, subcategory?: string }} category
 */
export function offerMatchesDepartment(departmentId, offer, category) {
  if (departmentId === "carnes") return matchesCarnesDepartment(offer);
  if (departmentId === FRIOS_EMBUTIDOS_DEPARTMENT_ID) return matchesFriosEmbutidosDepartment(category);
  return category.groupId === departmentId;
}

/** @param {Iterable<{ productType?: string, productTypes?: string[], detail?: string }>} offers */
export function buildDepartmentOfferCounts(offers, categoryFor) {
  const ids = [...PINNED_POPULAR_DEPARTMENT_IDS, ...RANDOM_POPULAR_DEPARTMENT_IDS];
  /** @type {Map<string, number>} */
  const counts = new Map(ids.map((id) => [id, 0]));
  for (const offer of offers) {
    const category = categoryFor(offer);
    for (const id of ids) {
      if (offerMatchesDepartment(id, offer, category)) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
  }
  return counts;
}
