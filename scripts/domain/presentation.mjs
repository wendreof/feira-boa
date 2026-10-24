import { BRAND_CANONICAL_NAMES, normalizeForMatch } from "./brands.mjs";
import { cleanProductName, extractNameQuantity, normalizeProductNameCase, takeValidityBanner } from "./product-name.mjs";
import { extractBundleCodes, normalizeOfferNote } from "./offer-note.mjs";

export function normalizeOfferPresentation(offer) {
  const originalName = String(offer?.name ?? "").replace(/\s+/g, " ").trim();
  const originalBrand = String(offer?.brand ?? "").replace(/\s+/g, " ").trim();

  const banner = takeValidityBanner(originalName);
  const detailBundle = extractBundleCodes(String(offer?.detail ?? ""));
  const nameBundle = extractBundleCodes(banner.name, detailBundle.text);
  // A marca nunca é tirada do nome: o nome fica completo e a marca só aparece
  // quando a própria fonte informa o campo `brand`.
  const brand = BRAND_CANONICAL_NAMES.get(normalizeForMatch(originalBrand)) ?? originalBrand;
  const quantity = extractNameQuantity(cleanProductName(nameBundle.text), detailBundle.text || "Unidade");
  const baseName = quantity.name;

  const note = [
    normalizeOfferNote(offer?.note),
    ...nameBundle.notes,
    ...detailBundle.notes,
  ].filter(Boolean).join(" · ");

  const result = {
    ...offer,
    name: normalizeProductNameCase(baseName),
    brand,
    detail: quantity.detail,
    note,
  };
  const notice = [banner.banner, offer?.notice].filter(Boolean).join(" · ");
  if (notice) result.notice = notice;
  return result;
}

/**
 * Palavras do tipo de produto, com limites de palavra.
 *
 * A lista precisa respeitar a fronteira da palavra: sem ela, "Reparação"
 * casava com /racao/, "Coração" com /racao/ e "Original" com /gin/, o que
 * mandava cremes capilares e snacks para o setor errado.
 */
