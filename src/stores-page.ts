import { applySourceFreshness } from "./source-freshness";

applySourceFreshness();

for (const image of document.querySelectorAll<HTMLImageElement>(".source-logo img")) {
  const logo = image.parentElement;
  if (!logo) continue;
  if (image.complete && image.naturalWidth > 0) logo.classList.add("has-logo");
  image.addEventListener("load", () => logo.classList.add("has-logo"), { once: true });
  image.addEventListener("error", () => image.remove(), { once: true });
}
