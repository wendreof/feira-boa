/**
 * Guardrail de apresentação: confere se o nome/detalhe/aviso publicado ainda
 * carrega texto de folheto (banner de validade, promoção "pague:", código de
 * combo LV/PG, título de seção, símbolo solto, limite corrompido). Se um novo
 * folheto trouxer uma variante fora do limpo-padrão, o build falha em vez de
 * publicar a oferta suja — e o padrão novo entra no limpo-padrão.
 */

const SECTION_HEADER_PREFIX = /^(?:bebidas|mercearias|mercearia|a[cç]ougue(?:\s+e\s+peixaria)?|limpeza e perfumaria|bazar|hortifruti|padaria|higiene pessoal|congelados|frios e latic[ií]nios|latic[ií]nios e ovos)\s+/i;

/** @type {Array<[string, RegExp]>} */
const TEXT_JUNK = [
  ["validity banner", /^ofertas\s+(?:especiais|v[áa]lidas?)\b/i],
  ["stock copy", /\benquanto durarem\b/i],
  ["bundle promo prefix", /^(?:a\s*partir\s*de)\b|\bpague\s*:/i],
  ["bundle code", /\blv\s*\d+\s*pg(?:\s*\d+)?\b|\bl\d+p\d+\b/i],
  ["bundle promo", /\bleve\s*\d+.*\bpague|\bpague\s*\d+.*\bleve\s*\d+|\bcompre\s*\d+\s*unids?\b/i],
  ["section header", SECTION_HEADER_PREFIX],
  ["leading symbol", /^[^\p{L}\p{N}]/u],
];

/**
 * @param {{ name?: string, detail?: string, note?: string }} offer
 * @returns {string[]} motivos da violação, vazio quando a apresentação está limpa
 */
export function presentationViolations(offer) {
  const violations = [];
  const name = String(offer.name ?? "");
  const detail = String(offer.detail ?? "");
  const note = String(offer.note ?? "");

  for (const [label, pattern] of TEXT_JUNK) {
    if (pattern.test(name)) violations.push(`${name}: "${label}" ainda no nome`);
    if ((label === "bundle code" || label === "bundle promo") && pattern.test(detail)) {
      violations.push(`${name}: "${label}" ainda no detalhe`);
    }
  }

  for (const part of note.split(" · ")) {
    if (/^limite\b/i.test(part) && !/^limite de \d/i.test(part)) {
      violations.push(`${name}: aviso de limite corrompido "${part}"`);
    }
  }

  return violations;
}
