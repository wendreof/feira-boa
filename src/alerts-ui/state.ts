import type { AlertRule, NotificationEntry } from "../alerts";
import type { Offer } from "../types";

/** Estado da página de alertas. */
export const alertsState: {
  userId: string;
  rules: AlertRule[];
  notificationsPaused: boolean;
  history: NotificationEntry[];
  offersById: Map<string, Offer>;
  stores: string[];
  productTypes: string[];
  editingId: string | null;
  tab: "rules" | "history";
} = {
  userId: "",
  rules: [],
  notificationsPaused: false,
  history: [],
  offersById: new Map(),
  stores: [],
  productTypes: [],
  editingId: null,
  tab: "rules",
};
