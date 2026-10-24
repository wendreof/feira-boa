import type { Offer, ProfilePreferences } from "../types";
import type { ThemePreference } from "../theme";
import type { OfferReaction } from "../offer-reactions";

export type ViewMode = "grid" | "list";
export type ReactionCounts = { likes: number; dislikes: number };
export type AccountApi = typeof import("../account");
export type ReactionsApi = typeof import("../offer-reactions");
export type LoginIntent = "reaction" | "favorite";

export interface CardRefs {
  root: HTMLElement;
  art: HTMLElement;
  name: HTMLElement;
  brand: HTMLElement;
  spec: HTMLElement;
  info: HTMLElement;
  price: HTMLElement;
  oldPrice: HTMLElement;
  discount: HTMLElement;
  valid: HTMLElement;
  notice: HTMLElement;
  note: HTMLElement;
  branch: HTMLElement;
  sourceLink: HTMLAnchorElement;
  share: HTMLButtonElement;
  favoriteButtons: HTMLButtonElement[];
  like: HTMLButtonElement;
  likeCount: HTMLElement;
}

/** Estado da página de ofertas, compartilhado pelos módulos de app-ui. */
export const appState: {
  offers: Offer[];
  storeNames: string[];
  categories: Map<string, { groupId: string; subcategory: string }>;
  activeDepartment: string;
  activeStore: string;
  activeProductType: string;
  favoriteIds: Set<string>;
  favoriteOnly: boolean;
  sharedOfferId: string | null;
  viewMode: ViewMode;
  currentUserId: string | null;
  preferencesLoaded: boolean;
  pendingTheme: ThemePreference | null;
  reactionCounts: Map<string, ReactionCounts>;
  userReactions: Map<string, OfferReaction>;
  preferences: ProfilePreferences;
  accountApi: AccountApi | null;
  reactionsApi: ReactionsApi | null;
  cards: Map<string, CardRefs>;
} = {
  offers: [],
  storeNames: [],
  categories: new Map(),
  activeDepartment: "",
  activeStore: "Todas as lojas",
  activeProductType: "",
  favoriteIds: new Set(),
  favoriteOnly: false,
  sharedOfferId: null,
  viewMode: "grid",
  currentUserId: null,
  preferencesLoaded: false,
  pendingTheme: null,
  reactionCounts: new Map(),
  userReactions: new Map(),
  preferences: { favoriteOfferIds: [], favoriteStores: [], favoriteProductTypes: [], theme: "light" },
  accountApi: null,
  reactionsApi: null,
  cards: new Map(),
};
