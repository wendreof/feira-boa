import {
  matchesOfferSearch,
  normalizeSearchText,
  parseSearchTerms,
} from "./offer-search.mjs";

/**
 * @param {{ name?: string, detail?: string, store?: string }} offer
 * @param {string} query
 */
function productMatches(offer, query) {
  const document = normalizeSearchText([offer.name, offer.detail].filter(Boolean).join(" "));
  return matchesOfferSearch(query, document);
}

function rankLabel(label, query) {
  const normalized = normalizeSearchText(label);
  const first = parseSearchTerms(query)[0] ?? "";
  if (first && normalized.startsWith(first)) return 2;
  if (first && normalized.includes(first)) return 1;
  return 0;
}

/**
 * Product and store suggestions for the top-bar search.
 * An empty query returns the busiest stores and repeated product names.
 * @param {Iterable<{ name?: string, detail?: string, store?: string }>} offers
 * @param {string} query
 * @param {{ limit?: number }} [options]
 * @returns {{ label: string, kind: "product" | "store", count: number }[]}
 */
export function suggestSearches(offers, query, options = {}) {
  const limit = options.limit ?? 6;
  if (!parseSearchTerms(query).length) return popularSuggestions(offers, limit);

  /** @type {Map<string, { label: string, kind: "product" | "store", count: number }>} */
  const products = new Map();
  /** @type {Map<string, { label: string, kind: "product" | "store", count: number }>} */
  const stores = new Map();

  for (const offer of offers) {
    const store = String(offer.store ?? "").trim();
    if (store && matchesOfferSearch(query, normalizeSearchText(store))) {
      const key = normalizeSearchText(store);
      const current = stores.get(key) ?? { label: store, kind: "store", count: 0 };
      current.count += 1;
      stores.set(key, current);
    }
    if (!productMatches(offer, query)) continue;
    const name = String(offer.name ?? "").trim();
    if (!name) continue;
    const key = normalizeSearchText(name);
    const current = products.get(key) ?? { label: name, kind: "product", count: 0 };
    current.count += 1;
    products.set(key, current);
  }

  const ranked = [...stores.values(), ...products.values()].sort((a, b) => {
    const byRank = rankLabel(b.label, query) - rankLabel(a.label, query);
    if (byRank) return byRank;
    if (a.kind !== b.kind) return a.kind === "store" ? -1 : 1;
    if (b.count !== a.count) return b.count - a.count;
    return a.label.length - b.label.length;
  });
  return ranked.slice(0, limit);
}

/** @param {Iterable<{ name?: string, store?: string }>} offers */
function popularSuggestions(offers, limit) {
  /** @type {Map<string, { label: string, kind: "product" | "store", count: number }>} */
  const stores = new Map();
  /** @type {Map<string, { label: string, kind: "product" | "store", count: number }>} */
  const products = new Map();
  for (const offer of offers) {
    const store = String(offer.store ?? "").trim();
    if (store) {
      const key = normalizeSearchText(store);
      const current = stores.get(key) ?? { label: store, kind: "store", count: 0 };
      current.count += 1;
      stores.set(key, current);
    }
    const name = String(offer.name ?? "").trim();
    if (!name) continue;
    const key = normalizeSearchText(name);
    const current = products.get(key) ?? { label: name, kind: "product", count: 0 };
    current.count += 1;
    products.set(key, current);
  }
  const repeated = [...products.values()].filter((item) => item.count > 1).sort((a, b) => b.count - a.count);
  return [...stores.values()].sort((a, b) => b.count - a.count).slice(0, 3).concat(repeated.slice(0, limit)).slice(0, limit);
}
