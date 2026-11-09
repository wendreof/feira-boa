import { normalizeSearchText } from "./offer-search.mjs";

/**
 * When the search box looks like a store name, return that store label for UI copy.
 * @param {string[]} storeNames
 * @param {string} searchQuery
 * @returns {string | null}
 */
export function storeNameFromSearch(storeNames, searchQuery) {
  const query = normalizeSearchText(searchQuery);
  if (query.length < 2) return null;
  for (const name of storeNames) {
    if (name === "Todas as lojas") continue;
    const normalized = normalizeSearchText(name);
    if (normalized === query || (query.length >= 3 && normalized.includes(query))) {
      return name;
    }
  }
  return null;
}
