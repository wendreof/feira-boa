const AUTO_STORE_IDS = ["paguemenos", "bigbom", "spani"];
const VISION_STORE_IDS = ["spasso", "corso"];

const STORE_ALIASES = new Map([
  ["spasso sabores", "spasso"],
  ["spasso", "spasso"],
  ["corso", "corso"],
  ["pague menos", "paguemenos"],
  ["paguemenos", "paguemenos"],
  ["big bom", "bigbom"],
  ["bigbom", "bigbom"],
  ["spani", "spani"],
  ["spani atacadista", "spani"],
  ["forte mix", "fortemix"],
  ["fortemix", "fortemix"],
  ["sempre vale", "sempre"],
  ["sempre", "sempre"],
]);

/**
 * @param {string | null | undefined} raw
 * @returns {string | null} null means full ingest (all stores)
 */
export function normalizeIngestStoreFilter(raw) {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.toLowerCase() === "all") return null;
  const key = trimmed.toLowerCase();
  return STORE_ALIASES.get(key) ?? key;
}

/**
 * @param {string | null} storeFilter from normalizeIngestStoreFilter
 */
export function snapshotAgeStoreIds(storeFilter) {
  if (!storeFilter) return [...AUTO_STORE_IDS];
  if (AUTO_STORE_IDS.includes(storeFilter)) return [storeFilter];
  return [];
}

/**
 * @param {string | null} storeFilter
 */
export function visionCacheStoreIds(storeFilter) {
  if (!storeFilter) return [...VISION_STORE_IDS];
  if (VISION_STORE_IDS.includes(storeFilter)) return [storeFilter];
  return [];
}