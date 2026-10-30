
const SECTION_HEADER_PATTERN = /^(?:bebidas|mercearias|mercearia|a[cç]ougue(?:\s+e\s+peixaria)?|limpeza e perfumaria|bazar|hortifruti|padaria|higiene pessoal|congelados|frios e latic[ií]nios|latic[ií]nios e ovos)\s+/i;

function stripSectionHeaders(name) {
  let value = name;
  for (;;) {
    const match = value.match(SECTION_HEADER_PATTERN);
    if (!match) return value;
    const rest = value.slice(match[0].length).trim();
    if (!rest) return value;
    value = rest;
  }
}

export function cleanProductName(name) {
  return stripSectionHeaders(
    name.replace(/\s+/g, " ")
      .replace(/^\d{1,2}\s+a\s+\d{1,2}\s+de\s+[a-zç]{3,}\.?\s+/i, "")
      .replace(/^a\s+mais\s+/i, "")
      .replace(/^(?:a\s*partir\s*de\s*)?(?:\d+\s*)?unidades?\s*,?\s*pague\s*:?\s*(?:r\$\s*)?(?:\d+(?:[.,]\d+)?\s*)?/i, "")
      .replace(/^nesta (?:embalagem|oferta) a unid(?:e|ade)\.?\s+sai por\s*:?\s*/i, "")
      .replace(/^(?:ou|e)\s+/i, "")
      .replace(/\s+(?:ou|e)$/i, ""),
  ).replace(/^[\s\p{P}\p{S}\p{C}]+|[\s·,/;\-\u2013\u2014\p{S}\p{C}]+$/gu, "").trim();
}


const CASE_MINOR_WORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "ou", "com", "em", "por", "para", "sem",
  "no", "na", "nos", "nas", "ao", "aos", "pelo", "pela", "c", "s", "sob", "sobre",
]);
const CASE_UNIT_WORDS = new Set([
  "kg", "g", "mg", "ml", "l", "lt", "un", "unid", "unidade", "unidades",
  "pc", "pcs", "pct", "cx", "fl", "kt",
]);

function capitalizeCaseSegment(segment) {
  return segment.charAt(0).toLocaleUpperCase("pt-BR") + segment.slice(1).toLocaleLowerCase("pt-BR");
}

// Marcas com capitalização interna que o Title Case não pode reescrever.
const PRESERVED_CASE_WORDS = new Map([["mccain", "McCain"]]);

function normalizeCaseWord(word, isFirst) {
  const bare = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (PRESERVED_CASE_WORDS.has(bare)) return PRESERVED_CASE_WORDS.get(bare);
  if (!isFirst && (CASE_MINOR_WORDS.has(bare) || CASE_UNIT_WORDS.has(bare))) {
    return word.toLowerCase();
  }
  const numberUnit = word.match(/^(\d+(?:[.,]\d+)?)([A-Za-z]+\.?)$/);
  if (numberUnit) return `${numberUnit[1]}${numberUnit[2].toLowerCase()}`;
  return word.split("-").map(capitalizeCaseSegment).join("-");
}

/**
 * Nome do produto sempre em Title Case (ex.: "CARNE MOÍDA 500G" e
 * "carne moída" viram "Carne Moída 500g"). Palavras de ligação e unidades
 * ficam em minúsculas quando não abrem o nome.
 */
export function normalizeProductNameCase(name) {
  const value = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!value) return value;
  let first = true;
  return value.split(/(\s+)/).map((part) => {
    if (!part || /^\s+$/.test(part)) return part;
    const result = normalizeCaseWord(part, first);
    first = false;
    return result;
  }).join("");
}

/**
 * Abreviação de unidade do folheto ("11 Unid.", "Unids.") vira a palavra
 * completa ("11 unidades", "Unidade"): a oferta publicada nunca encurta
 * "unidade"/"unidades".
 */
export function expandDetailUnits(detail) {
  const value = String(detail ?? "").replace(/\s+/g, " ").trim();
  if (!value) return value;
  return value
    .replace(/(\b\d+(?:[.,]\d+)?)\s*unids?\b\.?/gi, (full, count) => {
      const isSingle = Number(count.replace(",", ".")) === 1;
      return `${count} ${isSingle ? "unidade" : "unidades"}`;
    })
    .replace(/\bunids?\b\.?/gi, "unidade");
}

const DETAIL_UNIT_SYMBOLS = "kg|g|mg|ml|l|lt|un|cm|mm|m|pct|cx";
const SPLIT_QUANTITY_PATTERN = new RegExp(`(\\d(?:[.,]\\d)?)\\s+(${DETAIL_UNIT_SYMBOLS})\\b`, "gi");
const UNIT_ONLY_PATTERN = new RegExp(`^(${DETAIL_UNIT_SYMBOLS})$`, "i");

/**
 * Unidade de medida sempre no formato "1kg": número colado na unidade e
 * símbolo em minúsculas ("1 KG" e "1 kg" viram "1kg", "Kg" vira "kg").
 * Palavras por extenso ("11 unidades") ficam com espaço, como no nome.
 */
export function joinDetailQuantity(detail) {
  const value = String(detail ?? "").replace(/\s+/g, " ").trim();
  if (!value) return value;
  const joined = value.replace(SPLIT_QUANTITY_PATTERN, (full, amount, unit) => `${amount}${unit.toLowerCase()}`);
  return UNIT_ONLY_PATTERN.test(joined) ? joined.toLowerCase() : joined;
}

/**
 * Frase de validade que o folheto imprime ACIMA do produto e o PDF cola no
 * nome (ex.: "Ofertas válidas de quinta a domingo ... durarem nossos estoques.")
 * O texto vira `notice` (aviso acima do nome), nunca nome.
 */
export function takeValidityBanner(name) {
  const match = name.match(/^(ofertas\s+(?:especiais|v[áa]lidas?)\b.*?estoques?\.)\s*/i);
  if (!match) return { banner: "", name };
  return { banner: match[1].replace(/\s+/g, " ").trim(), name: name.slice(match[0].length).trim() };
}

/**
 * Códigos de combo do folheto ("LV12 PG11", "L4P3", "Leve 12un Pague 11un")
 * viram aviso legível ("Leve 12 e pague 11") em vez de nome ou unidade.
 * `payHint` é o detalhe cortado do fim do nome pelo adapter: quando o nome
 * termina em "Leve 250ml Pague", o valor pago é o próprio detalhe.
 */

const NAME_QUANTITY_PATTERN = /(?<![\p{L}\d+])(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)(?![\p{L}\d%])/giu;
const PLACEHOLDER_DETAIL_PATTERN = /^(unidades?|unid\.?|un\.?)$/i;

/**
 * Quantidade/unidade escrita no nome (ex.: "Lacta 80g", "Suco Aurora 1,5L Uva").
 * Só age quando há exatamente uma quantidade no nome: se o `detail` ainda é
 * placeholder ("Unidade"), ele recebe a quantidade; se já tem quantidade real,
 * ela prevalece e a cópia do nome sai. Nomes com várias quantidades (kits,
 * multipacks) ficam como estão.
 */
export function extractNameQuantity(name, detail) {
  const matches = [...name.matchAll(NAME_QUANTITY_PATTERN)];
  if (matches.length !== 1) return { name, detail };
  const [token] = matches;
  const quantity = `${token[1]}${token[2].toLowerCase()}`;
  const stripped = cleanProductName(
    `${name.slice(0, token.index)} ${name.slice(token.index + token[0].length)}`
      .replace(/\s+/g, " ")
      .replace(/\s+(?:de|c\/|com|por)\s*$/i, ""),
  );
  const nextDetail = !detail || PLACEHOLDER_DETAIL_PATTERN.test(detail) ? quantity : detail;
  return { name: stripped, detail: nextDetail };
}
