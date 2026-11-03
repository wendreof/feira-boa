import { TAXONOMY_GROUPS } from "../../src/catalog-taxonomy.mjs";
import { FRIOS_EMBUTIDOS_DEPARTMENT_ID } from "./frios-department.mjs";

/** Always shown in this order after the quick-sort chips. */
export const PINNED_POPULAR_DEPARTMENT_IDS = ["carnes", "bebidas_alcoolicas"];

const taxonomyRandomPool = TAXONOMY_GROUPS.map((group) => group.id).filter(
  (id) => id !== "outros" && !PINNED_POPULAR_DEPARTMENT_IDS.includes(id),
);

/** Shuffled once per page load; includes synthetic departments and taxonomy groups. */
export const RANDOM_POPULAR_DEPARTMENT_IDS = [
  FRIOS_EMBUTIDOS_DEPARTMENT_ID,
  ...taxonomyRandomPool,
].sort(() => Math.random() - 0.5);

export { FRIOS_EMBUTIDOS_DEPARTMENT_ID };
