/** First paint: mount this many offer cards synchronously. */
export const OFFER_GRID_INITIAL_CHUNK = 60;
/** Each idle/rAF follow-up batch. */
export const OFFER_GRID_IDLE_CHUNK = 40;

/**
 * @param {number} total
 * @param {{ initial?: number, idle?: number }} [sizes]
 * @returns {number[]}
 */
export function offerGridMountPlan(total, sizes = {}) {
  const initial = sizes.initial ?? OFFER_GRID_INITIAL_CHUNK;
  const idle = sizes.idle ?? OFFER_GRID_IDLE_CHUNK;
  if (!Number.isFinite(total) || total <= 0) return [];
  if (total <= initial) return [total];
  const plan = [initial];
  let remaining = total - initial;
  while (remaining > 0) {
    const take = Math.min(remaining, idle);
    plan.push(take);
    remaining -= take;
  }
  return plan;
}