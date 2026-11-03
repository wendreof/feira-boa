import { assignIcon } from "./icons.mjs";

/** @type {Record<string, string>} */
const TYPE_ICON = {
  "Carne bovina": "🥩",
  "Carnes suínas": "🐖",
  Peixes: "🐟",
  Frango: "🍗",
};

/**
 * Icon shown on offer cards (fixes bad feed icons like 🧂 on "Picanha Temperada").
 * @param {{ name?: string, icon?: string, productType?: string, department?: string }} offer
 */
export function displayOfferIcon(offer) {
  const assigned = assignIcon(offer.name ?? "", offer.productType ?? "", offer.department ?? "");
  const fromFeed = String(offer.icon ?? "").trim();
  if (!fromFeed || fromFeed === "🏷️" || fromFeed === "🧂") return assigned;
  const typeIcon = TYPE_ICON[offer.productType ?? ""];
  if (typeIcon && fromFeed !== typeIcon && (fromFeed === "🥩" && typeIcon === "🐖")) return typeIcon;
  if (typeIcon && fromFeed === "🧂") return typeIcon;
  return fromFeed;
}

/** @param {string} detail */
export function formatOfferSpec(detail) {
  const compact = String(detail ?? "").replace(/\s+/g, "").toLowerCase();
  if (compact === "kg") return "por kg";
  return String(detail ?? "").trim();
}
