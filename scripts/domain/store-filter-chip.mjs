import { resolveMainStoreLogo } from "../../src/shared/store-logos.mjs";

const DISPLAY_LABELS = {
  "Spani Atacadista": "Spani",
};

/** Plain data for a store filter chip (no DOM). */
export function describeStoreFilterChip(storeName, count) {
  const total = Number(count);
  if (storeName === "Todas as lojas") {
    return {
      label: "Todas",
      ariaLabel: `Todas as lojas, ${total} ofertas`,
      logoSrc: null,
      fallback: "",
      markClass: "",
    };
  }
  const meta = resolveMainStoreLogo({ storeName });
  const short = meta?.fallback ?? storeName.split(/\s+/)[0];
  const markClass =
    meta?.presentation === "bigbom-logo"
      ? "bigbom-mark"
      : meta?.presentation === "paguemenos-logo"
        ? "paguemenos-logo"
        : meta?.presentation === "fortemix-logo"
          ? "fortemix-mark"
          : "";
  return {
    label: DISPLAY_LABELS[storeName] ?? storeName,
    ariaLabel: `${storeName}, ${total} ofertas`,
    logoSrc: meta?.src ?? null,
    fallback: meta?.fallback ?? short.slice(0, 2).toUpperCase(),
    markClass,
  };
}
