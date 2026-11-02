/** Máximo de ofertas publicadas por encarte arquivado (evita inflar o offers.json). */
export const ARCHIVE_OFFER_CAP = 150;

/**
 * @param {{ store?: { sourceUrl?: string, from?: string, to?: string }, sourceUrl?: string }} snapshot
 */
export function campaignFingerprint(snapshot) {
  const store = snapshot?.store ?? {};
  return {
    sourceUrl: store.sourceUrl || snapshot.sourceUrl || "",
    from: store.from || "",
    to: store.to || "",
  };
}

/**
 * Verdadeiro quando o encarte publicado mudou (novo PDF, nova janela de validade, etc.).
 * @param {any} previous
 * @param {any} next
 */
export function snapshotCampaignChanged(previous, next) {
  if (!previous?.store || !next?.store) return false;
  const left = campaignFingerprint(previous);
  const right = campaignFingerprint(next);
  return left.sourceUrl !== right.sourceUrl || left.from !== right.from || left.to !== right.to;
}

/**
 * @param {string} storeId
 * @param {string} offerId
 */
export function archivedOfferId(storeId, offerId) {
  const prefix = String(storeId).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const suffix = String(offerId).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `arch-${prefix}-${suffix}`.replace(/-+/g, "-");
}
