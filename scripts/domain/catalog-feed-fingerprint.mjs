// @ts-nocheck
import { createHash } from "node:crypto";

/**
 * Stable fingerprint for the active catalog slice (detect ingest changes).
 * @param {{ updatedAt?: string, offers?: Array<{ id: string, validFrom: string, validTo: string }> }} feed
 * @param {string} today ISO date America/Sao_Paulo
 */
export function catalogFeedFingerprint(feed, today) {
  const updatedAt = String(feed?.updatedAt ?? "");
  const active = (feed?.offers ?? []).filter(
    (offer) => offer.validFrom <= today && offer.validTo >= today,
  );
  const ids = active.map((offer) => offer.id).sort();
  const idDigest = createHash("sha256").update(ids.join("\n")).digest("hex");
  return createHash("sha256").update(`${updatedAt}|${active.length}|${idDigest}`).digest("hex");
}

export function catalogPushAlreadySentToday(lastCatalogPushAt, today) {
  if (!lastCatalogPushAt) return false;
  const pushedOn = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(lastCatalogPushAt));
  return pushedOn === today;
}
