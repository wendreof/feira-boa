import { grid } from "./dom";

const LOADING_CLASS = "offer-grid--loading";
const SKELETON_CLASS = "offer-skeleton";
const SKELETON_COUNT = 6;

function createSkeletonCard(): HTMLElement {
  const card = document.createElement("article");
  card.className = SKELETON_CLASS;
  card.setAttribute("aria-hidden", "true");
  card.innerHTML = [
    '<div class="offer-skeleton-visual"></div>',
    '<div class="offer-skeleton-body">',
    '<span class="offer-skeleton-line offer-skeleton-line--title"></span>',
    '<span class="offer-skeleton-line offer-skeleton-line--meta"></span>',
    '<span class="offer-skeleton-line offer-skeleton-line--price"></span>',
    "</div>",
  ].join("");
  return card;
}

/** Placeholder cards until the feed is ready (e.g. retry after error). */
export function showOfferGridLoading(): void {
  if (grid.classList.contains(LOADING_CLASS)) return;
  grid.classList.add(LOADING_CLASS);
  grid.setAttribute("aria-busy", "true");
  grid.replaceChildren(...Array.from({ length: SKELETON_COUNT }, () => createSkeletonCard()));
}

/** Remove bootstrap skeleton before real offer cards mount. */
export function hideOfferGridLoading(): void {
  if (!grid.classList.contains(LOADING_CLASS)) return;
  grid.classList.remove(LOADING_CLASS);
  grid.removeAttribute("aria-busy");
  for (const skeleton of grid.querySelectorAll(`.${SKELETON_CLASS}`)) {
    skeleton.remove();
  }
}
