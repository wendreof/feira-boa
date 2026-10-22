/**
 * Guardrail de classificação: confere se o setor escolhido combina com o
 * nome do produto. Se um item cair num setor que o nome não permite, o
 * build falha em vez de publicar a oferta errada.
 *
 * As regras usam limite de palavra: "Reparação" não pode casar com /racao/.
 */

const SECTOR_INVARIANTS = [
  { label: "pet", words: /\b(racao|racoes|petisco|petiscos|coleira|comedouro|areia sanit|antipulgas|higiene animal)\b/, sectors: ["pet"] },
  { label: "bebidas_alcoolicas", words: /\b(cerveja|chopp|lager|pilsen|ipa|vinho|espumante|champanhe|whisky|vodka|aperitivo)\b/, sectors: ["bebidas_alcoolicas"] },
  { label: "higiene", words: /\b(shampoo|condicionador|leave in|leave-in|creme de pentear|creme para pentear|mascara capilar|oleo capilar|escova dental|fio dental|pasta de dente|enxaguante bucal|desodorante|sabonete|absorvente)\b/, sectors: ["higiene"] },
  { label: "congelados", words: /\b(nugget|nuggets|lasanha|empanado|hot pocket|hamburguer|sanduiche congelado|pizza congelada|macarrao congelado|congelado de bandeja)\b/, sectors: ["congelados"] },
  { label: "limpeza", words: /\b(detergente|desinfetante|sabao em po|amaciante|agua sanitaria|saponaceo|limpa vidros|multiuso)\b/, sectors: ["limpeza"] },
  { label: "casa", words: /\b(papel higienico|papel toalha|guardanapo)\b/, sectors: ["casa"] },
  { label: "bebidas", words: /\b(refrigerante|guarana|agua mineral|suco|isotonico|energetico)\b/, sectors: ["bebidas"] },
];

/**
 * @param {string} text nome e marca já normalizados
 * @returns {{ label: string, sector: string }[]} setores exigidos pelo nome
 */
export function expectedSectors(text) {
  const expected = [];
  for (const rule of SECTOR_INVARIANTS) {
    if (!rule.words.test(text)) continue;
    for (const sector of rule.sectors) expected.push({ label: rule.label, sector });
  }
  return expected;
}

/**
 * @param {string} name
 * @param {string} brand
 * @param {string} sectorId setor resolvido para a oferta
 * @param {string} text nome e marca já normalizados
 * @returns {string[]} motivos da violação, vazio quando o setor está correto
 */
export function sectorViolations(name, brand, sectorId, text) {
  const violations = [];
  for (const { label, sector } of expectedSectors(text)) {
    if (sector === sectorId) continue;
    violations.push(`${name} (${brand || "sem marca"}): "${label}" exige o setor ${sector}, mas foi para ${sectorId}`);
  }
  return violations;
}
