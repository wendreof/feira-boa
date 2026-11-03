import { foldAccents } from "../../src/shared/text.mjs";

/** Texto de busca sem acentos, minúsculas; pontuação vira espaço. */
export function normalizeSearchText(value) {
  const folded = foldAccents(String(value ?? ""))
    .toLocaleLowerCase("pt-BR")
    .replace(/(\d),(\d)/g, "$1.$2");
  return folded.replace(/[^\p{L}\p{N}.]+/gu, " ").replace(/\s+/g, " ").trim();
}

const STOP_WORDS = new Set([
  "a", "as", "o", "os", "e", "de", "da", "do", "das", "dos", "com", "sem", "ou", "para", "por",
  "no", "na", "nos", "nas", "em", "um", "uma", "uns", "umas",
]);

/** @type {string[][]} */
const ALIAS_GROUPS = [
  ["refri", "refrigerante", "refrigerantes"],
  ["iog", "iogurte", "iogurtes"],
  ["hig", "higienico", "higienica", "higiene"],
  ["achoc", "achocolatado"],
  ["xampu", "champu", "shampoo"],
  ["sabao", "sabonete"],
  ["cerveja", "cervejas", "chopp"],
  ["fralda", "fraldas"],
  ["pao", "paes"],
  ["cafe", "cafes"],
  ["leite", "lacteo", "lactea"],
  ["acougue", "acougues"],
  ["manteiga", "margarina"],
];

/** @type {Map<string, Set<string>>} */
const ALIAS_BY_TERM = (() => {
  const map = new Map();
  for (const group of ALIAS_GROUPS) {
    const normalized = group.map((term) => normalizeSearchText(term)).filter(Boolean);
    const bucket = new Set(normalized);
    for (const term of normalized) {
      const existing = map.get(term) ?? new Set();
      for (const alias of bucket) existing.add(alias);
      map.set(term, existing);
    }
  }
  return map;
})();

function expandSearchTerm(term) {
  const variants = new Set([term]);
  const aliases = ALIAS_BY_TERM.get(term);
  if (aliases) {
    for (const alias of aliases) variants.add(alias);
  }
  if (term.length > 3 && term.endsWith("s") && !term.endsWith("ss")) {
    variants.add(term.slice(0, -1));
  }
  if (term.length > 4 && term.endsWith("es")) {
    variants.add(term.slice(0, -2));
  }
  return [...variants];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = temp;
    }
  }
  return row[b.length];
}

function fuzzyWordMatch(term, word) {
  if (term.length < 4 || word.length < 3) return false;
  if (Math.abs(word.length - term.length) > 1) return false;
  return levenshtein(term, word) <= 1;
}

function termMatchesDocument(term, searchable, words) {
  const compact = searchable.replace(/\s/g, "");
  if (/^\d/.test(term)) {
    if (searchable.includes(term)) return true;
    if (words.some((word) => word === term || word.startsWith(`${term}.`))) return true;
  }
  for (const variant of expandSearchTerm(term)) {
    if (variant.length >= 2 && searchable.includes(variant)) return true;
    if (variant.length >= 5 && compact.includes(variant)) return true;
    if (words.some((word) => word.startsWith(variant) && variant.length >= 2)) return true;
    if (variant.length >= 4 && words.some((word) => fuzzyWordMatch(variant, word))) return true;
  }
  return false;
}

/** Termos significativos da busca (ignora artigos/preposições). */
export function parseSearchTerms(query) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const raw = normalized.split(/\s+/).filter(Boolean);
  const terms = raw.filter((term) => !STOP_WORDS.has(term));
  if (raw.length && !terms.length) return [];
  return terms;
}

/** Monta o texto indexável de uma oferta (campos visíveis ao usuário). */
export function buildOfferSearchDocument(offer, category = {}) {
  const parts = [
    offer.name,
    offer.detail,
    offer.category,
    offer.department,
    ...(offer.productTypes ?? []),
    category.subcategory,
    category.groupLabel,
    offer.store,
    offer.branch,
    offer.note,
    offer.notice ?? "",
  ];
  return normalizeSearchText(parts.filter(Boolean).join(" "));
}

/** Todas as palavras da busca precisam bater no documento (ordem livre). */
export function matchesOfferSearch(query, searchableDocument) {
  const terms = parseSearchTerms(query);
  if (!terms.length) return true;
  const words = searchableDocument.split(/\s+/).filter(Boolean);
  return terms.every((term) => termMatchesDocument(term, searchableDocument, words));
}
