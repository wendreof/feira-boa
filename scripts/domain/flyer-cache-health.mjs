/**
 * @param {string} storeId
 * @param {string | null | undefined} liveHash
 * @param {string | null | undefined} cachedHash
 */
export function flyerCacheHashProblems(storeId, liveHash, cachedHash) {
  if (!liveHash) return [`${storeId}: could not read live flyer hash`];
  if (!cachedHash) return [`${storeId}: campaign cache missing flyerHash`];
  if (liveHash !== cachedHash) {
    return [`${storeId}: campaign cache stale (live ${liveHash}, cache ${cachedHash})`];
  }
  return [];
}