export interface OfferSource {
  name: string;
  branch: string;
  logo: string;
  source: string;
  sourceUrl: string;
  from: string;
  to: string;
}

export interface Offer {
  id: string;
  store: string;
  storeLogo: string;
  branch: string;
  name: string;
  brand: string;
  detail: string;
  category: string;
  department: string;
  productType: string;
  productTypes: string[];
  price: number;
  previousPrice: number | null;
  icon: string;
  tone: string;
  note: string;
  validFrom: string;
  validTo: string;
  source: string;
  sourceUrl: string;
}

export interface OfferFeed {
  schemaVersion: 1;
  updatedAt: string;
  stores: OfferSource[];
  offers: Offer[];
}

export interface ProfilePreferences {
  favoriteOfferIds: string[];
  favoriteStores: string[];
  favoriteProductTypes: string[];
  theme: "light" | "dark";
}
