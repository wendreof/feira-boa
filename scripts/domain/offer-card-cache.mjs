/**
 * @typedef {{ cachedIds: Iterable<string>, matchingIds: ReadonlySet<string>, liveOfferIds: ReadonlySet<string> }} PartitionOfferCardCacheInput
 * @typedef {{ evict: string[], detach: string[] }} PartitionOfferCardCacheResult
 */

/**
 * Cards that no longer match filters are detached from the grid but kept for reuse.
 * Cards for offers removed from the feed are evicted from the cache.
 *
 * @param {PartitionOfferCardCacheInput} input
 * @returns {PartitionOfferCardCacheResult}
 */
export function partitionOfferCardCache(input) {
  const evict = [];
  const detach = [];
  for (const id of input.cachedIds) {
    if (!input.liveOfferIds.has(id)) {
      evict.push(id);
      continue;
    }
    if (!input.matchingIds.has(id)) {
      detach.push(id);
    }
  }
  return { evict, detach };
}

/**
 * @param {string[]} matchingOfferIds
 * @param {ReadonlyMap<string, unknown>} cachedCards
 */
export function shouldRemountOffersSynchronously(matchingOfferIds, cachedCards) {
  if (matchingOfferIds.length === 0) return true;
  return matchingOfferIds.every((id) => cachedCards.has(id));
}