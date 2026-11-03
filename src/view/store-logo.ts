import { resolveMainStoreLogo } from "../shared/store-logos.mjs";
import type { Offer } from "../types";

export interface OfferCardLogo {
  src: string | null;
  fallback: string;
  markClass: string;
}

function initialsFromStoreName(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function markClassForPresentation(presentation: string): string {
  if (presentation === "bigbom-logo") return "bigbom-mark";
  if (presentation === "fortemix-logo") return "fortemix-mark";
  return presentation;
}

/** Logo metadata for offer cards (image URL, initials fallback, presentation class). */
export function resolveOfferCardLogo(offer: Pick<Offer, "store" | "storeLogo">): OfferCardLogo {
  const meta = resolveMainStoreLogo({ storeName: offer.store });
  const published = offer.storeLogo?.startsWith("logos/") ? offer.storeLogo : null;
  const src = published ?? meta?.src ?? (offer.storeLogo || null);
  const fallback = meta?.fallback ?? initialsFromStoreName(offer.store);
  const markClass = markClassForPresentation(meta?.presentation ?? "");
  return { src, fallback, markClass };
}
