export const FRIOS_EMBUTIDOS_SUBCATEGORY = "Frios e embutidos";

/** Home quick filter id (not a taxonomy groupId). */
export const FRIOS_EMBUTIDOS_DEPARTMENT_ID = "frios_embutidos";

/**
 * @param {{ subcategory?: string }} category
 */
export function matchesFriosEmbutidosDepartment(category) {
  return category.subcategory === FRIOS_EMBUTIDOS_SUBCATEGORY;
}
