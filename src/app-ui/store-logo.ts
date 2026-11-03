import { resolveOfferCardLogo } from "../view/store-logo";
import type { Offer } from "../types";

export interface OfferStoreLogoRefs {
  root: HTMLSpanElement;
  fallback: HTMLSpanElement;
  img: HTMLImageElement;
}

export function createOfferStoreLogo(): OfferStoreLogoRefs {
  const root = document.createElement("span");
  root.className = "offer-store-logo logo-fallback";
  const fallback = document.createElement("span");
  fallback.className = "store-logo-fallback";
  fallback.setAttribute("aria-hidden", "true");
  const img = document.createElement("img");
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  root.append(fallback, img);
  return { root, fallback, img };
}

const MARK_CLASSES = ["bigbom-mark", "paguemenos-logo", "bigbom-logo", "fortemix-mark"];

export function updateOfferStoreLogo(refs: OfferStoreLogoRefs, offer: Offer): void {
  const { src, fallback, markClass } = resolveOfferCardLogo(offer);
  refs.fallback.textContent = fallback;
  refs.root.title = offer.branch || offer.store;
  refs.root.setAttribute("aria-label", offer.store);

  refs.root.classList.remove("has-logo", "logo-fallback", ...MARK_CLASSES);
  if (markClass) refs.root.classList.add(markClass);

  const applyFallback = () => {
    refs.root.classList.remove("has-logo");
    refs.root.classList.add("logo-fallback");
    refs.img.removeAttribute("src");
  };

  const applyLoaded = () => {
    refs.root.classList.add("has-logo");
    refs.root.classList.remove("logo-fallback");
  };

  if (!src) {
    applyFallback();
    return;
  }

  refs.img.onload = () => {
    applyLoaded();
    refs.img.onload = null;
    refs.img.onerror = null;
  };
  refs.img.onerror = () => {
    applyFallback();
    refs.img.onload = null;
    refs.img.onerror = null;
  };

  if (refs.img.src !== new URL(src, document.baseURI).href) {
    refs.root.classList.remove("has-logo");
    refs.img.src = src;
  }

  if (refs.img.complete && refs.img.naturalWidth > 0) {
    applyLoaded();
  }
}
