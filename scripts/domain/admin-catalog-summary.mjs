/**
 * @param {string} today ISO date in America/Sao_Paulo (YYYY-MM-DD)
 */
export function addCalendarDays(today, days) {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isActiveOffer(offer, today) {
  return today >= offer.validFrom && today <= offer.validTo;
}

/**
 * @param {{ offers: any[], stores: any[], archivedCampaigns?: any[], updatedAt: string }} feed
 * @param {string} today
 * @param {Record<string, { needsReview?: boolean, error?: boolean }>} sourceStatus
 */
export function summarizeCatalog(feed, today, sourceStatus = {}) {
  const active = feed.offers.filter((offer) => isActiveOffer(offer, today));
  const archivedCampaigns = feed.archivedCampaigns ?? [];
  const archivedOffers = archivedCampaigns.reduce((total, campaign) => total + (campaign.offers?.length ?? 0), 0);
  const statuses = Object.values(sourceStatus);
  const tomorrow = addCalendarDays(today, 1);
  const expiringSoon = active.filter((offer) => offer.validTo === today || offer.validTo === tomorrow).length;
  const storesWithoutActive = feed.stores.filter((store) => !active.some((offer) => offer.store === store.name)).length;

  return {
    updatedAt: feed.updatedAt,
    totalOffers: feed.offers.length,
    activeCount: active.length,
    archivedCampaigns: archivedCampaigns.length,
    archivedOffers,
    storeCount: feed.stores.length,
    storesWithoutActive,
    expiringSoon,
    sourcesNeedingReview: statuses.filter((entry) => entry.needsReview).length,
    sourcesWithErrors: statuses.filter((entry) => entry.error).length,
  };
}

/**
 * @param {string} storeName
 * @param {Record<string, { store?: string | null, needsReview?: boolean, error?: boolean, checkedAt?: string, lastSuccessAt?: string }>} sourceStatus
 */
export function findSourceStatusForStore(storeName, sourceStatus) {
  return Object.entries(sourceStatus).find(([, entry]) => entry?.store === storeName)?.[1] ?? null;
}

/**
 * @param {string} storeName
 * @param {Record<string, { store?: string | null }>} sourceStatus
 */
export function monitoredSourceUrlForStore(storeName, sourceStatus) {
  const match = Object.entries(sourceStatus).find(([, entry]) => entry.store === storeName);
  return match ? match[0] : null;
}

/**
 * @param {{ name: string, sourceUrl: string, from: string, to: string }} store
 * @param {{ offers: any[], archivedCampaigns?: { store?: { name?: string, to?: string }, offers?: any[] }[] }} feed
 * @param {string} today
 */
export function summarizeStoreCatalog(store, feed, today) {
  const storeOffers = feed.offers.filter((offer) => offer.store === store.name);
  const active = storeOffers.filter((offer) => isActiveOffer(offer, today));
  const archived = (feed.archivedCampaigns ?? []).find((campaign) => campaign.store?.name === store.name);
  return {
    activeCount: active.length,
    totalInFeed: storeOffers.length,
    archivedCount: archived?.offers?.length ?? 0,
    archivedValidTo: archived?.store?.to ?? null,
    windowFrom: store.from,
    windowTo: store.to,
  };
}

/**
 * @param {{ needsReview?: boolean, error?: boolean }} status
 */
export function sourceHealthLabel(status) {
  if (!status) return { tone: "unknown", label: "Sem monitor registrado" };
  if (status.needsReview) return { tone: "review", label: "Aguarda conferência" };
  if (status.error) return { tone: "error", label: "Falha na verificação" };
  return { tone: "ok", label: "Monitor OK" };
}
