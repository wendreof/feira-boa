import type { AlertRule } from "../alerts";
import type { Offer } from "../types";

/** Estado da página de alertas. */
export const alertsState: {
  userId: string;
  rules: AlertRule[];
  offersById: Map<string, Offer>;
  stores: string[];
  productTypes: string[];
  editingId: string | null;
} = {
  userId: "",
  rules: [],
  offersById: new Map(),
  stores: [],
  productTypes: [],
  editingId: null,
};
