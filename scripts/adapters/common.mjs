// Common utilities for offer adapters, validation, and product classification.

const RETRYABLE_STATUS = new Set([408, 425, 429]);

export async function fetchWithRetry(url, init = {}, { attempts = 3, timeoutMs = 30_000, delayMs = 400, fetchImpl = fetch } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      const retryable = RETRYABLE_STATUS.has(response.status) || response.status >= 500;
      if (!retryable || attempt === attempts) return response;
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
  }
  throw lastError ?? new Error(`Could not fetch ${url}`);
}

const MONTHS = {
  janeiro: "01", jan: "01",
  fevereiro: "02", fev: "02",
  marco: "03", março: "03", mar: "03",
  abril: "04", abr: "04",
  maio: "05", mai: "05",
  junho: "06", jun: "06",
  julho: "07", jul: "07",
  agosto: "08", ago: "08",
  setembro: "09", set: "09",
  outubro: "10", out: "10",
  novembro: "11", nov: "11",
  dezembro: "12", dez: "12",
};

export function parseDateRange(text, referenceYear = new Date().getFullYear()) {
  if (!text || typeof text !== "string") return null;
  const clean = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

  // Pattern 1: de DD/MM ate DD/MM/YYYY or DD/MM a DD/MM/YYYY
  const m1 = clean.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*(?:ate|a|-)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) {
    const fromYear = m1[3] || m1[6];
    const fromMonth = m1[2].padStart(2, "0");
    const fromDay = m1[1].padStart(2, "0");
    const toYear = m1[6];
    const toMonth = m1[5].padStart(2, "0");
    const toDay = m1[4].padStart(2, "0");
    return {
      from: `${fromYear}-${fromMonth}-${fromDay}`,
      to: `${toYear}-${toMonth}-${toDay}`,
    };
  }

  // Pattern 2: DD a DD de [mes] de [ano]
  const m2 = clean.match(/(\d{1,2})\s*(?:a|ate|-)\s*(\d{1,2})\s*(?:de\s+)?([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (m2 && MONTHS[m2[3]]) {
    const fromDay = m2[1].padStart(2, "0");
    const toDay = m2[2].padStart(2, "0");
    const month = MONTHS[m2[3]];
    const year = m2[4] || String(referenceYear);
    return {
      from: `${year}-${month}-${fromDay}`,
      to: `${year}-${month}-${toDay}`,
    };
  }

  // Pattern 3: DD a DD/MM/YYYY
  const m3 = clean.match(/(\d{1,2})\s*(?:a|ate|-)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m3) {
    const fromDay = m3[1].padStart(2, "0");
    const toDay = m3[2].padStart(2, "0");
    const month = m3[3].padStart(2, "0");
    const year = m3[4];
    return {
      from: `${year}-${month}-${fromDay}`,
      to: `${year}-${month}-${toDay}`,
    };
  }

  return null;
}

export function parsePrice(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "string") return null;
  const match = value.match(/R\$\s*(\d+)\s*[,.]\s*(\d{2})/i) || value.match(/(\d+)\s*[,.]\s*(\d{2})/);
  if (match) {
    return parseFloat(`${match[1]}.${match[2]}`);
  }
  return null;
}

export function slug(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const BRAND_ALIASES = [
  ["3 Corações", ["3 CORACOES", "3 CORAÇÕES"]],
  ["Avelícia", ["AVELÍCIA"]],
  ["São Lucas / Seletto", ["SÃO LUCAS OU SELETTO", "SÃO LUCAS / SELETTO"]],
  ["São Lucas", ["SÃO LUCAS"]],
  ["Seletto", ["SELETTO"]],
  ["Borges", ["BORGES"]],
  ["Shefa", ["SHEFA"]],
  ["Demarchi", ["DEMARCHI"]],
  ["Colônia", ["COLÔNIA"]],
  ["Sol", ["SOL"]],
  ["Quatá", ["QUATÁ"]],
  ["Pioneiro", ["PIONEIRO"]],
  ["ABS", ["ABS"]],
  ["Skala", ["SKALA"]],
  ["Nestlé", ["NESTLÉ"]],
  ["Mor", ["MOR"]],
  ["Val", ["VAL"]],
  ["Panco", ["PANCO"]],
  ["Maguary", ["MAGUARY"]],
  ["H2OH", ["H2OH"]],
  ["Banho a Banho", ["BANHO A BANHO"]],
  ["Seara", ["SEARA"]],
  ["Gomes da Costa", ["GOMES DA COSTA"]],
  ["Vitaliv", ["VITALIV"]],
  ["Mili", ["MILI"]],
  ["Nescau", ["NESCAU"]],
  ["MaisDoce", ["MAISDOCE"]],
  ["Kero Coco", ["KERO COCO"]],
  ["Lindoya", ["LINDOYA"]],
  ["Ypê", ["YPÊ"]],
  ["Aurora", ["AURORA"]],
  ["Broto Legal", ["BROTO LEGAL"]],
  ["Prato Fino", ["PRATO FINO"]],
  ["Bem Brasil", ["BEM BRASIL"]],
  ["Casagrande", ["CASAGRANDE"]],
  ["Vigor", ["VIGOR"]],
  ["Cassini", ["CASSINI"]],
  ["Bono / Negresco", ["BONO/ NEGRESCO", "BONO / NEGRESCO"]],
  ["Bono", ["BONO"]],
  ["Negresco", ["NEGRESCO"]],
  ["Renata", ["RENATA"]],
  ["Minueto", ["MINUETO"]],
  ["Garoto", ["GAROTO"]],
  ["Caboclo", ["CABOCLO"]],
  ["Melitta", ["MELITTA"]],
  ["Nutella", ["NUTELLA"]],
  ["Italac", ["ITALAC"]],
  ["Colgate", ["COLGATE"]],
  ["Búfalo", ["BÚFALO"]],
  ["Rexona", ["REXONA"]],
  ["Baly", ["BALY"]],
  ["Scotch-Brite", ["SCOTCH- BRITE", "SCOTCH BRITE"]],
  ["Maravilha", ["MARAVILHA"]],
  ["New Fort", ["NEW FORT"]],
  ["Seda", ["SEDA"]],
  ["São Caipira", ["SÃO CAIPIRA"]],
  ["Omo", ["OMO"]],
  ["Brilhante", ["BRILHANTE"]],
  ["Líder", ["LÍDER"]],
  ["Zulu", ["ZULU"]],
  ["Basilar", ["BASILAR"]],
  ["Doriana", ["DORIANA"]],
  ["Heinz", ["HEINZ"]],
  ["Perdigão", ["PERDIGÃO"]],
  ["Café Pelé", ["CAFE PELE", "CAFÉ PELÉ"]],
  ["Itambé", ["ITAMBE", "ITAMBÉ"]],
  ["Johnson's", ["JOHNSON´S", "JOHNSON'S"]],
  ["L'Or", ["L'OR"]],
  ["Lay's", ["LAYS", "LAY'S", "LAY´S"]],
  ["Mãe Terra", ["MAE TERRA", "MÃE TERRA"]],
  ["Pilão", ["PILAO", "PILÃO"]],
  ["Piraquê", ["PIRAQUE", "PIRAQUÊ"]],
  ["SBP", ["SBP"]],
  ["BR Spices", ["BR SPICES"]],
  ["YoPRO", ["YOPRO"]],
  ["Olá", ["OLA", "OLÁ"]],
  ["Del Valle", ["DEL VALLE"]],
  ["Neve", ["NEVE"]],
  ["Friboi", ["FRIBOI"]],
  ["Energy Dog", ["ENERGY DOG"]],
  ["Coca-Cola", ["COCA COLA", "COCA-COLA"]],
  ["Frutap", ["FRUTAP"]],
  ["Palmolive", ["PALMOLIVE"]],
  ["Ipanema", ["IPANEMA"]],
  ["One", ["ONE"]],
  ["Bebê Feliz", ["BEBÊ FELIZ"]],
  ["Concha y Toro", ["CONCHA Y TORO"]],
  ["Rayovac", ["RAYOVAC"]],
  ["Duracell", ["DURACELL"]],
  ["Ourolux", ["OUROLUX"]],
  ["Jacaré", ["JACARÉ", "JACARE"]],
  ["Bauducco", ["BADUCCO"]],
  ["Pedigree", ["PEDIGREE"]],
  ["Whiskas", ["WHISKAS"]],
  ["Snow Flakes", ["SNOW FLAKES"]],
  ["Pururuca", ["PURURUCA"]],
  ["Guaraná Antarctica", ["GUARANÁ ANTARCTICA"]],
];

const ACCENT_CLASSES = {
  a: "[aáàâãä]", e: "[eéèêë]", i: "[iíìîï]", o: "[oóòôõö]", u: "[uúùûü]",
  c: "[cç]", n: "[nñ]", y: "[yýÿ]",
};

function normalizeForMatch(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function brandPattern(alias) {
  const tokens = normalizeForMatch(alias).split(" ").filter(Boolean);
  if (!tokens.length || tokens.join("").length < 3) return null;
  const source = tokens.map((token) => [...token]
    .map((character) => ACCENT_CLASSES[character] ?? escapeRegex(character)).join(""))
    .join("[^a-z0-9]+");
  return new RegExp(`(?<![a-z0-9])${source}(?![a-z0-9])`, "gi");
}

function addBrandAlias(map, brand, alias) {
  const pattern = brandPattern(alias);
  if (!pattern) return;
  const key = normalizeForMatch(alias);
  if (!key || map.has(key)) return;
  map.set(key, { brand, pattern });
}

function aliasesForBrand(brand) {
  const key = normalizeForMatch(brand);
  const aliases = new Map();
  for (const [canonical, names] of BRAND_ALIASES) {
    if (normalizeForMatch(canonical) === key || names.some((name) => normalizeForMatch(name) === key)) {
      for (const name of names) addBrandAlias(aliases, canonical, name);
    }
  }
  if (aliases.size === 0) addBrandAlias(aliases, brand, brand);
  return [...aliases.values()];
}

const ALL_BRAND_ALIASES = (() => {
  const aliases = new Map();
  for (const [brand, names] of BRAND_ALIASES) {
    for (const name of names) addBrandAlias(aliases, brand, name);
  }
  return [...aliases.values()];
})();

const BRAND_CANONICAL_NAMES = (() => {
  const names = new Map();
  for (const [brand, aliases] of BRAND_ALIASES) {
    names.set(normalizeForMatch(brand), brand);
    for (const alias of aliases) names.set(normalizeForMatch(alias), brand);
  }
  return names;
})();

function findBrandMatches(name, aliases) {
  const matches = [];
  for (const alias of aliases) {
    alias.pattern.lastIndex = 0;
    for (const match of name.matchAll(alias.pattern)) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        brand: alias.brand,
      });
    }
  }
  matches.sort((left, right) => left.start - right.start || (right.end - right.start) - (left.end - left.start));
  const selected = [];
  for (const match of matches) {
    if (selected.some((item) => match.start < item.end && match.end > item.start)) continue;
    selected.push(match);
  }
  return selected;
}

function cleanProductName(name) {
  return name.replace(/\s+/g, " ")
    .replace(/^\d{1,2}\s+a\s+\d{1,2}\s+de\s+[a-zç]{3,}\.?\s+/i, "")
    .replace(/^(?:a\s*partir\s*de\s*)?(?:\d+\s*)?unidades?\s*,?\s*pague\s*:?\s*/i, "")
    .replace(/^(?:ou|e)\s+/i, "")
    .replace(/\s+(?:ou|e)$/i, "")
    .replace(/^[\s·,/;-]+|[\s·,/;-]+$/g, "")
    .trim();
}

export function normalizeOfferNote(value) {
  const note = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!note) return "";

  const limit = note.match(/^limite (?:por cliente\s*|de\s+)(\d+(?:[.,]\d+)?)\s*(kg|g|un\.?|unid\.?|unidade?s?)(?:\s+por cliente)?$/i);
  if (limit) {
    const quantity = limit[1].replace(".", ",");
    const unit = limit[2].toLowerCase().replace(".", "");
    const unitLabel = unit === "kg" || unit === "g"
      ? unit
      : Number(quantity.replace(",", ".")) === 1 ? "unidade" : "unidades";
    return `Limite de ${quantity} ${unitLabel} por cliente`;
  }

  const promotion = note.match(/^nesta oferta a unid\. sai por (.+)$/i);
  if (promotion) {
    const details = promotion[1]
      .replace(/\bPOR\b/gi, "por")
      .replace(/\bPAGUE\b/gi, "pague")
      .replace(/\bLEVE\b/gi, "leve");
    return `Nesta oferta, a unidade sai por ${details}`;
  }

  return note.split(" · ").map((part) => {
    if (/^preço club plus$/i.test(part)) return "Preço Club Plus";
    if (/^oferta do açougue/i.test(part)) return `Oferta do açougue${part.slice("Oferta do açougue".length)}`;
    return part;
  }).join(" · ");
}

const CASE_MINOR_WORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "ou", "com", "em", "por", "para", "sem",
  "no", "na", "nos", "nas", "ao", "aos", "pelo", "pela", "c", "s", "sob", "sobre",
]);
const CASE_UNIT_WORDS = new Set([
  "kg", "g", "mg", "ml", "l", "lt", "un", "unid", "unidade", "unidades",
  "pc", "pcs", "pct", "cx", "fl", "kt",
]);

function isScreamingCase(text) {
  return /\p{Ll}/u.test(text) === false && (text.match(/\p{L}/gu)?.length ?? 0) >= 3;
}

function normalizeCaseWord(word, isFirst) {
  const bare = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (!isFirst && (CASE_MINOR_WORDS.has(bare) || CASE_UNIT_WORDS.has(bare))) {
    return word.toLowerCase();
  }
  const numberUnit = word.match(/^(\d+(?:[.,]\d+)?)([A-Za-z]+\.?)$/);
  if (numberUnit) return `${numberUnit[1]}${numberUnit[2].toLowerCase()}`;
  return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1).toLocaleLowerCase("pt-BR");
}

/**
 * Converte nomes em CAIXA ALTA de folheto para leitura normal.
 * Nomes já mistos (ex.: "BISTECA Suína") passam intactos.
 */
export function normalizeProductNameCase(name) {
  const value = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!value || !isScreamingCase(value)) return value;
  let first = true;
  return value.split(/(\s+)/).map((part) => {
    if (!part || /^\s+$/.test(part)) return part;
    const result = normalizeCaseWord(part, first);
    first = false;
    return result;
  }).join("");
}

export function normalizeOfferPresentation(offer) {
  const originalName = String(offer?.name ?? "").replace(/\s+/g, " ").trim();
  const originalBrand = String(offer?.brand ?? "").replace(/\s+/g, " ").trim();
  const matches = originalBrand
    ? findBrandMatches(originalName, aliasesForBrand(originalBrand))
    : findBrandMatches(originalName, ALL_BRAND_ALIASES);
  let brand = originalBrand;
  let name = originalName;

  if (matches.length > 0) {
    name = cleanProductName(originalName
      .slice(0, matches[0].start)
      + matches.slice(1).reduce((result, match, index) => result + originalName.slice(matches[index].end, match.start), "")
      + originalName.slice(matches[matches.length - 1].end));
    if (!originalBrand) brand = [...new Set(matches.map((match) => match.brand))].join(" / ");
    if (name.length < 2) {
      name = originalName;
      brand = originalBrand;
    }
  }
  brand = BRAND_CANONICAL_NAMES.get(normalizeForMatch(brand)) ?? brand;

  return {
    ...offer,
    name: normalizeProductNameCase(name || originalName),
    brand,
    note: normalizeOfferNote(offer?.note),
  };
}

/**
 * Palavras do tipo de produto, com limites de palavra.
 *
 * A lista precisa respeitar a fronteira da palavra: sem ela, "Reparação"
 * casava com /racao/, "Coração" com /racao/ e "Original" com /gin/, o que
 * mandava cremes capilares e snacks para o setor errado.
 */
const PRODUCT_TYPE_RULES = [
  [/\b(sabao em po|detergente|amaciante|agua sanitaria|saponaceo|desinfetante|multiuso)\b/, "Lavanderia e limpeza"],
  [/\b(condicionador|shampoo|leave in|leave-in|creme leave in|creme de pentear|mascara capilar|oleo capilar|reparador de pontas|tratamento capilar|serum capilar|creme dental|pasta de dente|escova dental|fio dental|enxaguante|antisseptico|higiene bucal|absorvente|sabonete|desodorante|antiperspirante|protetor solar|perfume|maquiagem|barbear|depiladora|toalha umedecida)\b/, "Higiene pessoal"],
  [/\b(biscoito|bolacha|wafer|cookie|salgadinho|batata palha|chocolate|bombom|pacoquinha|doce de leite|pirulito|caramelo|goiabada|bala|chiclete|creme de avela|creme avela|nutella|avela)\b/, "Doces e snacks"],
  [/\b(nugget|nuggets|empanado|empanad[oa]s?|lasanha|ravioli|capeletti|hot pocket|hot bowls|hamburguer|pizza|sanduiche|sandwich|nhoque|quibe|kibe|macarrao pronto|macarrao congelado|batata palito|congelado de bandeja|feijoada)\b/, "Congelados"],
  [/\b(cerveja|chopp|pilsen|lager|ipa|ale|original weiss|weiss)\b/, "Cervejas"],
  [/\b(vinho|aperitivo|espumante|champanhe|whisky|vodka|gin)\b/, "Bebidas alcoólicas"],
  [/\b(refrigerante|guarana|cola|coca|pepsi)\b/, "Refrigerantes"],
  [/\b(suco|néctar|agua mineral|agua de coco|agua tonica|isotonico|energetico|refresco)\b/, "Sucos e bebidas"],
  [/\b(cafe|espresso|cappuccino|capuccino|cafeteira|cafeteria)\b/, "Café"],
  [/\b(leite em po|leite uht|leite integral|leite fermentado|leite longa vida|bebida lactea|leite de aveia)\b/, "Leites"],
  [/\b(iogurte|danoninho|yogurte)\b/, "Iogurtes"],
  [/\b(requeijao|ricota|queijo minas|queijo prato|mussarela|mucarela)\b/, "Queijos e requeijão"],
  [/\b(manteiga|margarina)\b/, "Manteiga"],
  [/\b(ketchup|mostarda|maionese)\b/, "Mercearia"],
  [/\b(presunto|mortadela|salsicha|linguica|bacon|embutido|salami|salame|pepperoni|quibe)\b/, "Frios"],
  [/\b(suina|suino|pernil|bisteca|panceta)\b/, "Carnes suínas"],
  [/\b(bovino|bovina|contrafile|paleta|alcatra|fraldinha|maminha|figado|acem|lombo|costela|patinho|picanha|entrecote|ancho|file mignon|filé mignon|carne moida)\b/, "Carne bovina"],
  [/\b(frango|asa de|coxa|sobrecoxa|filezinho|chicken|sassami|moela|tulipa)\b/, "Frango"],
  [/\b(tilapia|peixe|sardinha|atum|merluza)\b/, "Peixes"],
  [/\b(ovos|ovo)\b/, "Ovos"],
  [/\b(sorvete|picole|picolé|gelato|torta)\b/, "Congelados"],
  [/\b(lava-roupas|lava roupas|sabao|detergente|amaciante|limpa|limpador|desinfetante|saponaceo|agua sanitaria|hipoclorito|cloro|inseticida|repelente)\b/, "Lavanderia e limpeza"],
  [/\b(papel higienico|papel toalha|guardanapo|toalha de papel)\b/, "Papel higiênico"],
  [/\b(pilha|bateria|lampada|esponja|lixeira|pano de|carvao|vaso|organizador|arara|cesto|cabide)\b/, "Casa"],
  [/\b(sandalia|sapato|tenis|tennis|chinelo)\b/, "Calçados"],
  [/\b(new fort|fort lar|fervedor)\b/, "Casa"],
  [/\b(arroz|feijao|acucar|macarrao|massa para|farinha|azeite|maionese|ketchup|mostarda|azeitona|seleta|milho|oleo soja|molho|creme de leite|leite condensado|pao de forma|cereal|granola|aveia|filtro de papel|caldo|sopa|sal|vinagre|tempero|shoyu)\b/, "Mercearia"],
  [/\b(tomate|batata|cebola|cenoura|alface|banana|maca|fruta|verdura|legume|abacaxi|melancia|melao|laranja|uva|alho|manga|abobora|chuchu|repolho|abobrinha|pepino|milho verde|brocolis|couve|beterraba|brocolis|palmito|aipim|abacate|melancia)\b/, "Hortifruti"],
  [/\b(racao|racoes|petisco|petiscos|coleira|comedouro|areia sanit|areia sanitaria|antipulgas|higiene animal|shampoo pet|alimento para|para caes|para gatos)\b/, "Pet"],
];

/**
 * Categorias do próprio catálogo da loja (o caminho vem no JSON do Pague
 * Menos). A loja é a fonte da verdade: o caminho é mais confiável do que
 * qualquer palavra do nome, então ele tem prioridade sobre as regras.
 *
 * As chaves são os dois primeiros níveis do caminho; o valor é o tipo de
 * produto. Um prefixo vazio casa com qualquer nível.
 */
const STORE_CATEGORY_TYPES = new Map([
  ["congelados", "Congelados"],
  ["cafe da manha/cafe", "Café"],
  ["cafe da manha/leite", "Leites"],
  ["cafe da manha/bebidas matinais", "Café"],
  ["cafe da manha/cereal e granola", "Mercearia"],
  ["cafe da manha/aveias e mingaus", "Mercearia"],
  ["cafe da manha/padaria", "Mercearia"],
  ["bebidas/cervejas", "Cervejas"],
  ["bebidas/sucos e refrigerantes", "Refrigerantes"],
  ["bebidas/agua, energetico e cha", "Sucos e bebidas"],
  ["bebidas", "Sucos e bebidas"],
  ["limpeza", "Lavanderia e limpeza"],
  ["perfumaria", "Higiene pessoal"],
  ["mercearia/biscoitos e salgadinhos", "Doces e snacks"],
  ["mercearia/bombonerie", "Doces e snacks"],
  ["mercearia/doces", "Doces e snacks"],
  ["mercearia/cafe e achocolatados", "Café"],
  ["mercearia/molhos frios", "Mercearia"],
  ["mercearia/temperos e condimentos", "Mercearia"],
  ["mercearia/alimentos funcionais", "Mercearia"],
  ["mercearia/sementes e nozes", "Mercearia"],
  ["mercearia", "Mercearia"],
  ["frios e laticinios/embutidos", "Frios"],
  ["frios e laticinios/frios", "Frios"],
  ["frios e laticinios/queijo", "Queijos e requeijão"],
  ["frios e laticinios/patês e pastas", "Mercearia"],
  ["frios e laticinios/lácteos/iogurte", "Iogurtes"],
  ["frios e laticinios/lácteos/leite fermentado", "Leites"],
  ["frios e laticinios/lácteos/manteiga", "Manteiga"],
  ["frios e laticinios/lácteos/requeijão", "Queijos e requeijão"],
  ["frios e laticinios/lácteos/sobremesa láctea", "Congelados"],
  ["frios e laticinios/lácteos", "Leites"],
  ["acougue/aves", "Frango"],
  ["acougue/suína", "Carnes suínas"],
  ["mamae e bebe", "Higiene pessoal"],
  ["hortifruti", "Hortifruti"],
]);

function normalizeForCategory(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Tipo de produto a partir do caminho de categoria da loja, quando ela
 * informa um caminho completo. Retorna null quando o caminho é inútil.
 */
export function classifyByStoreCategory(path) {
  const segments = normalizeForCategory(path).split("/").filter(Boolean);
  if (segments.length < 2) return null;
  for (let size = Math.min(3, segments.length); size >= 1; size -= 1) {
    const type = STORE_CATEGORY_TYPES.get(segments.slice(0, size).join("/"));
    if (type) return type;
  }
  return null;
}

/**
 * Tipo de produto para a categoria grossa da loja, usada quando o nome não
 * diz nada. A chave é a categoria como a loja escreve; o valor é sempre um
 * tipo de produto, nunca um departamento.
 *
 * Também cobre os departamentos que as ofertas já gravadas carregam, para
 * que um snapshot antigo seja reclassificado sem novo scraping.
 */
const CATEGORY_PRODUCT_TYPES = new Map([
  ["acougue", "Carne bovina"],
  ["acougue e peixaria", "Carne bovina"],
  ["aves", "Frango"],
  ["bebidas", "Bebidas"],
  ["bebidas alcoolicas", "Bebidas alcoólicas"],
  ["cafe", "Café"],
  ["cafe da manha", "Café"],
  ["calçados", "Calçados"],
  ["calcados", "Calçados"],
  ["carnes", "Carne bovina"],
  ["casa", "Casa"],
  ["casa e limpeza", "Lavanderia e limpeza"],
  ["congelados", "Congelados"],
  ["frios", "Frios"],
  ["frios e laticinios", "Frios e laticínios"],
  ["hortifruti", "Hortifruti"],
  ["higiene", "Higiene pessoal"],
  ["higiene e cuidados", "Higiene pessoal"],
  ["laticinios", "Leites"],
  ["limpeza", "Lavanderia e limpeza"],
  ["mamae e bebe", "Higiene pessoal"],
  ["mercearia", "Mercearia"],
  ["padaria", "Mercearia"],
  ["peixes", "Peixes"],
  ["perfumaria", "Higiene pessoal"],
  ["pet", "Pet"],
  ["vestuario", "Calçados"],
  ["vestuario e calcados", "Calçados"],
]);

/**
 * Classifica uma oferta em tipo de produto e departamento.
 *
 * `category` é a categoria da loja (fallback) e `storeCategory` é o caminho
 * completo do catálogo, quando disponível. O caminho da loja tem prioridade:
 * ele é definido pela própria loja e não depende de palpite por palavra.
 */
export function classifyProduct(name, brand, category, storeCategory = "") {
  const text = normalizeForCategory(`${name} ${brand}`);
  const normalizedCategory = category === "Geral" ? "Outros" : category;
  const storeType = classifyByStoreCategory(storeCategory);
  const matched = storeType
    ? [null, storeType]
    : PRODUCT_TYPE_RULES.find(([pattern]) => pattern.test(text));
  const productType = matched
    ? matched[1]
    : CATEGORY_PRODUCT_TYPES.get(normalizeForCategory(normalizedCategory)) ?? normalizedCategory;

  const departments = {
    "Frios e laticínios": "Frios e laticínios", "Iogurtes": "Frios e laticínios", "Queijos e requeijão": "Frios e laticínios", "Manteiga": "Frios e laticínios", "Frios": "Frios e laticínios",
    "Frango": "Açougue e peixaria", "Carne bovina": "Açougue e peixaria",
    "Carnes suínas": "Açougue e peixaria", "Peixes": "Açougue e peixaria", "Cervejas": "Bebidas",
    "Refrigerantes": "Bebidas", "Sucos e bebidas": "Bebidas", "Bebidas alcoólicas": "Bebidas",
    "Lavanderia e limpeza": "Casa e limpeza", "Papel higiênico": "Casa e limpeza", "Higiene pessoal": "Higiene e cuidados", "Doces e snacks": "Mercearia", "Hortifruti": "Hortifruti",
    "Congelados": "Congelados", "Mercearia": "Mercearia", "Café": "Mercearia", "Arroz": "Mercearia", "Feijão": "Mercearia", "Leites": "Frios e laticínios",
    "Ovos": "Mercearia", "Calçados": "Vestuário e calçados", "Pet": "Pet", "Casa": "Casa e limpeza", "Outros": "Outros",
  };
  const categoryDepartments = {
    "Carnes": "Açougue e peixaria", "Peixes": "Açougue e peixaria", "Frios": "Frios e laticínios", "Laticínios": "Frios e laticínios",
    "Limpeza": "Casa e limpeza", "Higiene": "Higiene e cuidados", "Mercearia": "Mercearia", "Bebidas": "Bebidas", "Congelados": "Congelados",
    "Pet": "Pet", "Casa": "Casa e limpeza", "Padaria": "Mercearia", "Hortifruti": "Hortifruti", "Vestuário": "Vestuário e calçados", "Outros": "Outros",
  };
  const isBarbecueProduct = /\bpicanha\b|\bfraldinha\b|\bmaminha\b|\bcostela\b|\bcontrafile\b|\bentrecote\b|\bancho\b|\blinguica\b|\bpao de alho\b|\bqueijo coalho\b|\bcarvao (para|de churrasco)\b|\bespeto\b|\bgrelha\b|\bacendedor\b|\bcoxa\b|\bsobrecoxa\b|\basa de frango\b|\bbisteca\b|\bpanceta\b/.test(text);
  // Produto pronto e congelado ("Hot Pocket X-picanha") não é corte para churrasco.
  const isChurrasco = isBarbecueProduct && productType !== "Congelados";
  return {
    department: departments[productType] ?? categoryDepartments[normalizedCategory] ?? normalizedCategory,
    productType,
    productTypes: isChurrasco ? [productType, "Churrasco"] : [productType],
  };
}


export function assignIcon(name, productType = "", department = "") {
  const normalize = (value) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const nameText = normalize(name);
  const fullText = normalize(`${name} ${productType}`);
  const rules = [
    // Higiene e limpeza primeiro: nomes como "Desinfetante Limão" ou "Repelente de Citronela" têm frutas.
    [/escova dental|creme dental|fio dental|enxaguante|antisseptic|higiene bucal|plax/, "🪥"],
    [/inseticida|repelente/, "🪰"],
    [/detergente|desinfetante|saponaceo|limpador|multiuso|amaciante|lava roupa|lava-roupas|lava loucas|lava louca|tira manchas|bloco sanitario|higienizador|limpa vidros|pastilha adesiva|sanitario|alcool|\bsabao\b|desodorizador|odorizador|odorizante|cloro/, "🧺"],
    [/esponja|bucha|flanela|la de aco|\bpano\b|panos/, "🧽"],
    [/lixeira|saco para lixo/, "🗑️"],
    [/pilha|bateria/, "🔋"],
    [/lampada/, "💡"],
    [/papel higienico|absorvente|fralda|toalha umedecida|papel toalha|toalha de papel|guardanapo/, "🧻"],
    [/shampoo|condicionador|leave-in|leave in|tratamento capilar|oleo capilar|creme de pentear|creme para pentear|creme multifuncional|creme de tratament|creme para tratament|creme noturno|tratamernto|reparador de pontas|serum|lustra|mascara de|sabonete|desodorante|hidratante|protetor solar|perfume|antiperspirante|difusor|aroma/, "🧴"],
    [/aparelho de barbear|barbear|depiladora/, "🪒"],
    [/suplemento|whey|creatina|aminoacido/, "💊"],

    // Mercearia e snacks: regras específicas antes das palavras genéricas.
    [/salgadinho/, "🥨"],
    [/pipoca/, "🍿"],
    [/bolinho/, "🧁"],
    [/filme de pvc|\bcopo\b/, "🥤"],
    [/tortilla chips|\bchips?\b/, "🥨"],
    [/rosquinha|donut/, "🍩"],
    [/biscoito|cookie|wafer|bolacha/, "🍪"],
    [/macarrao|lasanha|massa|ravioli|capeletti|talharim|nhoque|bolonhesa|meu menu|hot bowls/, "🍝"],
    [/tortinha|brownie|bolo|pao de mel/, "🎂"],
    [/sanduiche|sandwich|churrasburguer|cheeseburguer/, "🥪"],
    [/torta|empadao/, "🥧"],
    [/pizza/, "🍕"],
    [/hamburguer/, "🍔"],
    [/hot pocket/, "🥪"],
    [/empanado|nugget|almondega|kibe/, "🍗"],
    [/tempero|temperad|\bsal\b|condimento|chimi|oregano|paprica|paprika|cominho|canela|erva dulce|manjericao|curcuma|lemon pepper/, "🧂"],
    [/peixe|sardinha|atum|tilapia|merluza/, "🐟"],
    [/molho|azeite|\boleo\b|oleo de|maionese|ketchup|mostarda|extrato|pate de/, "🥫"],
    [/queijo|requeijao|ricota|queijinho/, "🧀"],
    [/manteiga|margarina/, "🧈"],
    [/caldo|sopa/, "🍲"],
    [/bacon/, "🥓"],
    [/linguica/, "🌭"],
    [/salsicha/, "🫔"],
    [/mortadela|presunto|salami|salame|pepperoni|embutido/, "🍖"],
    [/frango|coxa|sobrecoxa|sassami|asa de/, "🍗"],
    [/bisteca bovin|costela bovin|carne moida/, "🥩"],
    [/suin|pernil|bisteca|costelinha|panceta|torresmo|carre/, "🐖"],
    [/bovin|bife|picanha|alcatra|maminha|patinho|fraldinha|acem|contrafile|cupim|costela|figado|lombo|paleta/, "🥩"],
    [/carne|carneiro|charque/, "🍖"],
    [/farinha|trigo|cereal|muesli|amido/, "🌾"],
    [/cappuccino|capsula|espresso|cafe|filtro de papel/, "☕"],
    [/cerveja|chopp/, "🍺"],
    [/vinho|espumante|aperitivo|smirnoff|cachaca/, "🍷"],
    [/refrigerante|energetico|isotonico|h2oh|guarana/, "🥤"],
    [/suco|nectar|refresco/, "🧃"],
    [/agua de coco/, "🥥"],
    [/agua mineral|\bagua\b/, "💧"],
    [/bebida lactea|shake|creme de leite|bebida vegetal/, "🥛"],
    [/acucar|gelatina|goiabada|doce de leite/, "🍬"],
    [/\bleite\b|iogurte|achocolatado/, "🥛"],
    [/aveia|granola|mingau|cremogema/, "🥣"],
    [/sorvete|acai|açaí|picole|picolé|cobert[oa]/, "🍨"],
    [/chocolate|bombom|creme avela|creme de avela|nutella/, "🍫"],
    [/milho/, "🌽"],

    // Frutas, verduras e mercearia de base.
    [/tomate/, "🍅"],
    [/batata palito/, "🍟"],
    [/batata/, "🥔"],
    [/^ovos?\b/, "🥚"],
    [/banana/, "🍌"],
    [/manga/, "🥭"],
    [/abacaxi/, "🍍"],
    [/abacate/, "🥑"],
    [/\bmaca\b/, "🍎"],
    [/morango/, "🍓"],
    [/laranja/, "🍊"],
    [/limao/, "🍋"],
    [/melancia/, "🍉"],
    [/melao|mamao/, "🍈"],
    [/uva/, "🍇"],
    [/brocolis/, "🥦"],
    [/cenoura/, "🥕"],
    [/cebola/, "🧅"],
    [/alho/, "🧄"],
    [/abobora/, "🎃"],
    [/chuchu|pepino|abobrinha/, "🥒"],
    [/ervilha/, "🫛"],
    [/alface|repolho|couve|rucula|espinafre|acelga|beterraba|palmito/, "🥬"],
    [/arroz/, "🍚"],
    [/feijao|lentilha/, "🍲"],
    [/salada|legume|verdura|seleta/, "🥗"],
    [/pao|torrada/, "🍞"],
    [/azeitona/, "🫒"],
    [/amendoim|paçoquinha|castanha|sementes|mistura de|nozes/, "🥜"],
    [/petisco|osso|rachis|coleira|comedouro|areia sanit/, "🦴"],
    [/\bracao\b|\bracoes\b|cachorro|\bgato\b|alimento para/, "🐾"],
    [/sandalia|sapato|tenis|chinelo/, "👟"],
    [/ferro de passar/, "♨️"],
  ];
  // Primeiro tenta pelo nome (evita "Água de Coco" virando suco pelo tipo) e só depois pelo tipo.
  return rules.find(([pattern]) => pattern.test(nameText))?.[1]
    ?? rules.find(([pattern]) => pattern.test(fullText))?.[1]
    ?? "🏷️";
}

export function validateOffer(offer) {
  if (!offer || typeof offer !== "object") return false;
  if (!offer.id || typeof offer.id !== "string") return false;
  if (!offer.store || !offer.branch || !offer.name) return false;
  if (!/^https:\/\//.test(offer.sourceUrl)) return false;
  if (!Number.isFinite(offer.price) || offer.price <= 0) return false;
  if (offer.previousPrice !== null && (!Number.isFinite(offer.previousPrice) || offer.previousPrice <= offer.price)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(offer.validFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(offer.validTo)) return false;
  if (offer.validFrom > offer.validTo) return false;
  if (!offer.productType || !Array.isArray(offer.productTypes) || !offer.productTypes.includes(offer.productType)) return false;
  return true;
}

export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (!snapshot.storeId || !snapshot.store || !Array.isArray(snapshot.offers)) return false;
  if (snapshot.offers.length === 0) return false;
  return snapshot.offers.every(validateOffer);
}
