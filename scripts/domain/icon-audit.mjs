import { assignIcon } from "./icons.mjs";
import { displayOfferIcon } from "./display-offer.mjs";
import { expectedSectors } from "../offer-sector-guard.mjs";
import { foldText } from "../../src/shared/text.mjs";

export const GENERIC_ICON = "🏷️";
export const SPICE_ICON = "🧂";

/** @type {Record<string, string>} */
export const PRODUCT_TYPE_ICON = {
  "Carne bovina": "🥩",
  "Carnes suínas": "🐖",
  Peixes: "🐟",
  Frango: "🍗",
};

const FRUIT_ICONS = new Set(["🍋", "🍊", "🍎", "🍌", "🍇", "🥭", "🍍", "🥥", "🍓", "🍈", "🍉"]);
const CLEANING_HINT = /\b(detergente|desinfetante|sabao|amaciante|limpa|limpeza|lava.?louca|multiuso|saponaceo)\b/;

/**
 * @param {{ name?: string, icon?: string, productType?: string, department?: string, store?: string, id?: string }} offer
 */
export function auditOfferIcon(offer) {
  const name = String(offer.name ?? "").trim();
  const productType = String(offer.productType ?? "");
  const department = String(offer.department ?? "");
  const storedIcon = String(offer.icon ?? "").trim();
  const assigned = assignIcon(name, productType, department);
  const displayed = displayOfferIcon(offer);
  const text = foldText(name);
  /** @type {Array<{ kind: string, message: string, autoFixable?: boolean }>} */
  const issues = [];

  if (storedIcon && storedIcon !== assigned) {
    issues.push({
      kind: "stale_feed",
      message: `feed icon ${storedIcon} ≠ assignIcon ${assigned}`,
      autoFixable: true,
    });
  }

  if (assigned === GENERIC_ICON) {
    issues.push({
      kind: "generic_icon",
      message: "assignIcon returned generic tag (no keyword rule matched)",
    });
  } else if (storedIcon === SPICE_ICON && assigned !== SPICE_ICON) {
    issues.push({
      kind: "spice_override_candidate",
      message: `stored ${SPICE_ICON} but assignIcon now gives ${assigned}`,
      autoFixable: true,
    });
  }

  const typeExpected = PRODUCT_TYPE_ICON[productType];
  if (typeExpected && storedIcon && storedIcon !== typeExpected && assigned === storedIcon) {
    issues.push({
      kind: "type_icon_advisory",
      message: `productType ${productType} often uses ${typeExpected}, icon is ${storedIcon}`,
    });
  }

  if (FRUIT_ICONS.has(storedIcon) && CLEANING_HINT.test(text)) {
    issues.push({
      kind: "cleaning_fruit_icon",
      message: `cleaning-related name with fruit icon ${storedIcon}`,
    });
  }

  const sectors = expectedSectors(text);
  if (assigned === GENERIC_ICON && sectors.length > 0) {
    issues.push({
      kind: "generic_with_sector_hint",
      message: `name implies sector(s) ${sectors.map((s) => s.sector).join(", ")} but icon is generic`,
    });
  }

  if (displayed !== storedIcon && storedIcon) {
    issues.push({
      kind: "display_overrides_feed",
      message: `UI would show ${displayed} instead of feed ${storedIcon}`,
    });
  }

  return {
    id: offer.id ?? null,
    store: offer.store ?? null,
    name,
    productType,
    department,
    storedIcon,
    assigned,
    displayed,
    issues,
  };
}

/**
 * @param {Array<Record<string, unknown>>} offers
 */
export function summarizeIconAudit(offers) {
  const rows = offers.map((offer) => auditOfferIcon(offer));
  /** @type {Record<string, number>} */
  const issuesByKind = {};
  let autoFixable = 0;
  const flagged = [];

  for (const row of rows) {
    for (const issue of row.issues) {
      issuesByKind[issue.kind] = (issuesByKind[issue.kind] ?? 0) + 1;
      if (issue.autoFixable) autoFixable += 1;
    }
    if (row.issues.length > 0) {
      flagged.push({
        id: row.id,
        store: row.store,
        name: row.name,
        productType: row.productType,
        storedIcon: row.storedIcon,
        assigned: row.assigned,
        displayed: row.displayed,
        issues: row.issues,
      });
    }
  }

  flagged.sort((a, b) => {
    const aGeneric = a.issues.some((i) => i.kind === "generic_icon") ? 0 : 1;
    const bGeneric = b.issues.some((i) => i.kind === "generic_icon") ? 0 : 1;
    return aGeneric - bGeneric || String(a.name).localeCompare(String(b.name), "pt-BR");
  });

  return {
    summary: {
      totalOffers: offers.length,
      flaggedOffers: flagged.length,
      autoFixableIssues: autoFixable,
      issuesByKind,
      genericIcons: rows.filter((r) => r.assigned === GENERIC_ICON).length,
    },
    rows: flagged,
  };
}

/**
 * @param {Array<{ id?: string|null, name: string, productType?: string, department?: string, assigned: string, issues: Array<{ kind: string }> }>} flaggedRows
 * @param {number} limit
 */
export function pickGeminiReviewCandidates(flaggedRows, limit) {
  return flaggedRows
    .filter((row) => row.issues.some((i) => i.kind === "generic_icon" || i.kind === "generic_with_sector_hint"))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      name: row.name,
      productType: row.productType ?? "",
      department: row.department ?? "",
      assigned: row.assigned,
    }));
}