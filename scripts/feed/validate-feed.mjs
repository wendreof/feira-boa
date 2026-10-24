import { resolveCategory } from "../../catalog-taxonomy.mjs";
import { foldText } from "../../shared/text.mjs";
import { presentationViolations } from "../offer-name-guard.mjs";
import { sectorViolations } from "../offer-sector-guard.mjs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS_PATTERN = /^https:\/\//;

function assertStores(stores) {
  for (const store of stores) {
    const valid = store.name && store.branch && HTTPS_PATTERN.test(store.sourceUrl)
      && DATE_PATTERN.test(store.from) && DATE_PATTERN.test(store.to) && store.from <= store.to;
    if (!valid) throw new Error(`Invalid store source record: ${store.name || "unnamed store"}`);
  }
  const urls = new Set(stores.map((store) => store.sourceUrl));
  if (urls.size !== stores.length) throw new Error("Duplicate store source URL in offer catalog.");
  return urls;
}

function assertOfferFields(offer, storeUrls) {
  if (!offer.name || !offer.store || !offer.detail || !offer.productType || !Array.isArray(offer.productTypes) || !offer.productTypes.includes(offer.productType)) {
    throw new Error(`Offer is missing required product fields: ${offer.id}`);
  }
  if (!storeUrls.has(offer.sourceUrl) || !HTTPS_PATTERN.test(offer.sourceUrl)) {
    throw new Error(`Offer has no known official source: ${offer.id}`);
  }
  const priceValid = Number.isFinite(offer.price) && offer.price > 0
    && (offer.previousPrice === null || (Number.isFinite(offer.previousPrice) && offer.previousPrice > offer.price));
  if (!priceValid) throw new Error(`Offer has an invalid price: ${offer.id}`);
  if (!DATE_PATTERN.test(offer.validFrom) || !DATE_PATTERN.test(offer.validTo) || offer.validFrom > offer.validTo) {
    throw new Error(`Offer has invalid validity dates: ${offer.id}`);
  }
}

/**
 * Valida o feed publicado e lança erro na primeira inconsistência de dados
 * estruturais. Problemas de setor e de texto de apresentação são coletados e
 * reportados juntos.
 */
export function validateFeed({ stores, offers }) {
  const storeUrls = assertStores(stores);
  const ids = new Set();
  const sectorProblems = [];
  const presentationProblems = [];

  for (const offer of offers) {
    if (!offer.id || ids.has(offer.id)) throw new Error(`Missing or duplicate offer ID: ${offer.id}`);
    assertOfferFields(offer, storeUrls);

    const sector = resolveCategory(offer);
    const text = foldText(`${offer.name} ${offer.brand ?? ""}`);
    sectorProblems.push(...sectorViolations(offer.name, offer.brand ?? "", sector.groupId, text));
    presentationProblems.push(...presentationViolations(offer));
    ids.add(offer.id);
  }

  if (sectorProblems.length > 0) {
    throw new Error(`Offers are in the wrong sector:\n- ${sectorProblems.slice(0, 20).join("\n- ")}`);
  }
  if (presentationProblems.length > 0) {
    throw new Error(`Offers carry flyer text in the published fields — extend scripts/domain/presentation.mjs cleaning:\n- ${presentationProblems.slice(0, 20).join("\n- ")}`);
  }
}
