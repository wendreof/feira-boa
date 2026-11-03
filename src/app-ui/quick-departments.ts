import {
  FRIOS_EMBUTIDOS_DEPARTMENT_ID,
} from "../../scripts/domain/frios-department.mjs";
import { PINNED_POPULAR_DEPARTMENT_IDS } from "../../scripts/domain/popular-category-order.mjs";

export { FRIOS_EMBUTIDOS_DEPARTMENT_ID };

export type QuickDepartmentChip = {
  label: string;
  icon: string;
  /** Subcategory or group id key in renderPopularItems counts map. */
  offerCountKey?: string;
};

/** Synthetic home quick filters (not taxonomy group ids). */
export const QUICK_DEPARTMENT_CHIPS: Record<string, QuickDepartmentChip> = {
  carnes: { label: "Açougue (kg)", icon: "🥩" },
  [FRIOS_EMBUTIDOS_DEPARTMENT_ID]: {
    label: "Frios e embutidos",
    icon: "🥓",
    offerCountKey: "Frios e embutidos",
  },
};

/** Shorter pinned labels for narrow category tiles. */
export const PINNED_TAXONOMY_CHIP_LABELS: Record<string, string> = {
  bebidas_alcoolicas: "Alcoólicas",
};

/** Labels for synthetic home quick filters (not taxonomy group ids). */
export const QUICK_DEPARTMENT_LABELS: Record<string, string> = Object.fromEntries(
  [...PINNED_POPULAR_DEPARTMENT_IDS, FRIOS_EMBUTIDOS_DEPARTMENT_ID].map((id) => {
    const chip = QUICK_DEPARTMENT_CHIPS[id];
    if (chip) return [id, chip.label];
    const short = PINNED_TAXONOMY_CHIP_LABELS[id];
    if (short) return [id, short];
    return [id, id];
  }),
);
