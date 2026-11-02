/** Logos for the five monitored groceries (self-hosted, optimized PNGs). */

export const MAIN_STORE_IDS = ["semprevale", "bigbom", "paguemenos", "spasso", "corso"];

/** @type {Record<string, { src: string, fallback: string, presentation: string }>} */
export const MAIN_STORE_LOGOS = {
  semprevale: { src: "logos/semprevale.png", fallback: "SV", presentation: "" },
  bigbom: { src: "logos/bigbom.png", fallback: "BB", presentation: "bigbom-logo" },
  paguemenos: { src: "logos/paguemenos.png", fallback: "PM", presentation: "paguemenos-logo" },
  spasso: { src: "logos/spasso.png", fallback: "SS", presentation: "" },
  corso: { src: "logos/corso.png", fallback: "CO", presentation: "" },
};

/** @type {Record<string, string>} */
export const STORE_NAME_TO_ID = {
  "Sempre Vale": "semprevale",
  "Big Bom": "bigbom",
  "Pague Menos": "paguemenos",
  "Spasso Sabores": "spasso",
  "Corso": "corso",
};

export function logoUrlForStoreId(storeId) {
  return MAIN_STORE_LOGOS[storeId]?.src ?? null;
}

export function logoUrlForStoreName(storeName) {
  const storeId = STORE_NAME_TO_ID[storeName];
  return storeId ? logoUrlForStoreId(storeId) : null;
}

export function resolveMainStoreLogo(options = {}) {
  const { storeId, storeName } = options;
  const id = storeId && MAIN_STORE_LOGOS[storeId] ? storeId : STORE_NAME_TO_ID[storeName ?? ""];
  if (!id) return null;
  return { storeId: id, ...MAIN_STORE_LOGOS[id] };
}

export function withPublishedStoreLogo(store, storeId) {
  const meta = resolveMainStoreLogo({ storeId, storeName: store?.name });
  if (!meta) return store;
  return { ...store, logo: meta.src };
}

export function withPublishedOfferLogo(offer, storeId) {
  const url = logoUrlForStoreName(offer.store) ?? (storeId ? logoUrlForStoreId(storeId) : null);
  if (!url) return offer;
  return { ...offer, storeLogo: url };
}

export function applyPublishedLogos({ stores, offers, snapshotsByStore }) {
  const storeIdByName = new Map();
  if (snapshotsByStore) {
    for (const [key, snapshot] of snapshotsByStore) {
      storeIdByName.set(snapshot.store.name, snapshot.storeId || key);
    }
  }
  return {
    stores: stores.map((store) => withPublishedStoreLogo(store, storeIdByName.get(store.name))),
    offers: offers.map((offer) => {
      const storeId = storeIdByName.get(offer.store);
      return withPublishedOfferLogo(offer, storeId);
    }),
  };
}
