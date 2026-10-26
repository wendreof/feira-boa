import { BRAND_CANONICAL_NAMES, mergeBrandIntoName, normalizeForMatch } from "./brands.mjs";
import { cleanProductName, expandDetailUnits, extractNameQuantity, joinDetailQuantity, normalizeProductNameCase, takeValidityBanner } from "./product-name.mjs";
import { extractBundleCodes, normalizeOfferNote } from "./offer-note.mjs";

/**
 * Fronteira única de apresentação: limpa nome/detalhe/nota e publica a oferta
 * sem campo de marca — `BRAND_CANONICAL_NAMES` canoniza a marca informada pela
 * fonte e `mergeBrandIntoName` a coloca dentro de `name`.
 */
export function normalizeOfferPresentation(offer) {
  const { brand, ...source } = offer ?? {};
  const originalName = String(source.name ?? "").replace(/\s+/g, " ").trim();
  const originalBrand = String(brand ?? "").replace(/\s+/g, " ").trim();

  const banner = takeValidityBanner(originalName);
  const detailBundle = extractBundleCodes(String(source.detail ?? ""));
  const nameBundle = extractBundleCodes(banner.name, detailBundle.text);
  const canonicalBrand = BRAND_CANONICAL_NAMES.get(normalizeForMatch(originalBrand)) ?? originalBrand;
  const quantity = extractNameQuantity(cleanProductName(nameBundle.text), detailBundle.text || "Unidade");
  const baseName = normalizeProductNameCase(quantity.name);

  const note = [
    normalizeOfferNote(source.note),
    ...nameBundle.notes,
    ...detailBundle.notes,
  ].filter(Boolean).join(" · ");

  const result = {
    ...source,
    name: mergeBrandIntoName(baseName, canonicalBrand),
    detail: joinDetailQuantity(normalizeProductNameCase(expandDetailUnits(quantity.detail))),
    note,
  };
  const notice = [banner.banner, source.notice].filter(Boolean).join(" · ");
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
