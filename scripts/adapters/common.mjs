// Common utilities for offer adapters, validation, and product classification.

const RETRYABLE_STATUS = new Set([408, 425, 429]);

export async function fetchWithRetry(url, init = {}, { attempts = 3, timeoutMs = 30_000, delayMs = 400 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
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
    name: name || originalName,
    brand,
    note: normalizeOfferNote(offer?.note),
  };
}

export function classifyProduct(name, brand, category) {
  const text = `${name} ${brand} ${category}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const normalizedCategory = category === "Geral" ? "Outros" : category;
  const rules = [
    [/cafe/, "Café"], [/arroz/, "Arroz"], [/feijao/, "Feijão"], [/leite em po|leite uht|leite integral|leite fermentado|leite longa vida|bebida lactea/, "Leites"],
    [/condicionador|shampoo|creme dental|absorvente|sabonete|desodorante|higiene|toalha umedecida/, "Higiene pessoal"],
    [/iogurte|danoninho/, "Iogurtes"], [/requeijao|queijo|ricota/, "Queijos e requeijão"], [/manteiga|margarina/, "Manteiga"], [/mortadela|presunto/, "Frios"],
    [/ovos?\b/, "Ovos"], [/creme de avela|nutella/, "Doces e snacks"], [/sandalia|sapato|tenis|chinelo/, "Calçados"], [/new fort|fort lar|fervedor/, "Casa"],
    [/frango|asa de|coxa|sobrecoxa|filezinho|chicken|sassami/, "Frango"], [/bovino|contrafile|paleta|alcatra|fraldinha|figado|acem|lombo|costela|patinho/, "Carne bovina"],
    [/linguica|salsicha|panceta|suina|suino|bacon|pernil|bisteca/, "Carnes suínas e embutidos"], [/tilapia|peixe|sardinha|atum/, "Peixes"],
    [/cerveja/, "Cervejas"], [/refrigerante|guarana|h2oh/, "Refrigerantes"], [/suco|nectar|agua mineral|agua de coco|energetico|refresco/, "Sucos e bebidas"], [/vinho|aperitivo|smirnoff|gin/, "Bebidas alcoólicas"],
    [/lava-roupas|lava roupas|sabao|detergente|amaciante|limpeza|limpador|desinfetante|saponaceo/, "Lavanderia e limpeza"], [/papel higienico|papel higiênico/, "Papel higiênico"],
    [/sorvete|acai|congelad|lasanha|ravioli|capeletti|batata palito|hamburguer|brocolis/, "Congelados"],
    [/batata chips|biscoito|chocolate|pacoquinha|bombom|wafer/, "Doces e snacks"],
    [/(?!.*pelado)tomate|batata|cebola|cenoura|alface|banana|maca|maçã|fruta|verdura|legume|abacaxi|melancia|melao|laranja|uva|alho|manga|abobora|chuchu|repolho|abobrinha|pepino|milho verde/, "Hortifruti"],
    [/macarrao|massa para|farinha|azeite|maionese|ketchup|mostarda|azeitona|seleta|milho|acucar|achocolatado|oleo soja|molho|creme de leite|leite condensado|pao de forma|cereal|filtro de papel/, "Mercearia"],
    [/racao|\bdog\b|\bcat\b|\bpet\b/, "Pet"],
    [/pilha|esponja|lixeira|pano|lampada|carvao/, "Casa"],
  ];
  const matched = rules.find(([pattern]) => pattern.test(text));
  const productType = matched ? matched[1] : normalizedCategory;

  const departments = {
    "Frios e laticínios": "Frios e laticínios", "Iogurtes": "Frios e laticínios", "Queijos e requeijão": "Frios e laticínios", "Manteiga": "Frios e laticínios", "Frios": "Frios e laticínios",
    "Frango": "Açougue e peixaria", "Carne bovina": "Açougue e peixaria",
    "Carnes suínas e embutidos": "Açougue e peixaria", "Peixes": "Açougue e peixaria", "Cervejas": "Bebidas",
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
  const isBarbecueProduct = /picanha|fraldinha|maminha|costela|contrafile|entrecote|ancho|linguica|pao de alho|queijo coalho|carvao|espeto|grelha|acendedor|coxa|sobrecoxa|asa de frango|bisteca|panceta/.test(text);
  const primaryProductType = productType === normalizedCategory ? (categoryDepartments[normalizedCategory] ?? normalizedCategory) : productType;
  return {
    department: departments[productType] ?? categoryDepartments[normalizedCategory] ?? normalizedCategory,
    productType: primaryProductType,
    productTypes: isBarbecueProduct ? [primaryProductType, "Churrasco"] : [primaryProductType],
  };
}

export function assignIcon(name, productType = "", department = "") {
  const text = `${name} ${productType}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const rules = [
    [/agua sanitaria/, "🧴"],
    [/creme dental|fio dental|enxaguante|antisseptico bucal/, "🪥"],
    [/papel higienico|absorvente|fralda|toalha umedecida|papel toalha|toalha de papel|guardanapo/, "🧻"],
    [/creme de avela|nutella/, "🍫"],
    [/racao|cachorro|\bgato\b|\bcao\b|alimento para/, "🐾"],
    [/aparelho de barbear|barbear/, "🪒"],
    [/requeijao|queijo|ricota/, "🧀"],
    [/manteiga|margarina/, "🧈"],
    [/creme de leite|leite condensado|leite|iogurte|bebida lactea|achocolatado/, "🥛"],
    [/shampoo|condicionador|sabonete|desodorante|hidratante|protetor solar|creme\b|locao/, "🧴"],
    [/ferro|flon/, "♨️"],
    [/filtro de papel/, "☕"],
    [/cafe/, "☕"],
    [/cerveja|chopp/, "🍺"],
    [/vinho|espumante|aperitivo|smirnoff|cachaca|\bgin\b/, "🍷"],
    [/refrigerante|energetico|h2oh|guarana/, "🥤"],
    [/agua mineral/, "💧"],
    [/agua de coco/, "🥥"],
    [/suco|nectar|refresco/, "🧃"],
    [/\bagua\b/, "💧"],
    [/arroz/, "🍚"],
    [/feijao/, "🍲"],
    [/frango|coxa|sobrecoxa|sassami|asa de/, "🍗"],
    [/linguica|salsicha|bacon|panceta|mortadela/, "🌭"],
    [/carne|bife|costela|alcatra|acem|contrafile|picanha|patinho|fraldinha|paleta|figado|cupim|lombo|bisteca/, "🥩"],
    [/peixe|sardinha|atum|tilapia|merluza/, "🐟"],
    [/hamburguer/, "🍔"],
    [/batata palito/, "🍟"],
    [/batata/, "🥔"],
    [/^ovos?\b/, "🥚"],
    [/tomate/, "🍅"],
    [/banana/, "🍌"],
    [/uva/, "🍇"],
    [/melancia/, "🍉"],
    [/melao|mamao/, "🍈"],
    [/laranja/, "🍊"],
    [/limao/, "🍋"],
    [/manga/, "🥭"],
    [/abacaxi/, "🍍"],
    [/abacate/, "🥑"],
    [/\bmaca\b/, "🍎"],
    [/morango/, "🍓"],
    [/brocolis/, "🥦"],
    [/alface|repolho|couve|rucula|espinafre|acelga|beterraba/, "🥬"],
    [/cenoura/, "🥕"],
    [/cebola/, "🧅"],
    [/alho/, "🧄"],
    [/abobora/, "🎃"],
    [/chuchu|pepino|abobrinha/, "🥒"],
    [/ervilha/, "🫛"],
    [/farinha|trigo|aveia|cereal/, "🌾"],
    [/milho/, "🌽"],
    [/legume|verdura/, "🥕"],
    [/sorvete|acai|picole/, "🍨"],
    [/chocolate|bombom/, "🍫"],
    [/biscoito|cookie|wafer|bolacha/, "🍪"],
    [/bolo/, "🎂"],
    [/pao|torrada/, "🍞"],
    [/macarrao|lasanha|massa para|ravioli|capeletti|talharim/, "🍝"],
    [/azeitona/, "🫒"],
    [/tempero|\bsal\b/, "🧂"],
    [/molho|azeite|oleo|condimento/, "🥫"],
    [/pipoca/, "🍿"],
    [/salgadinho/, "🥨"],
    [/bolinho/, "🧁"],
    [/acucar|gelatina|goiabada|doce/, "🍬"],
    [/sabao|lava-roupas|lava roupas|detergente|amaciante|desinfetante|limpador|multiuso|alcool|inseticida/, "🧺"],
    [/esponja|bucha|pano|flanela|la de aco/, "🧽"],
    [/lixeira|saco para lixo/, "🗑️"],
    [/pilha|bateria/, "🔋"],
    [/lampada/, "💡"],
    [/carvao|fogo/, "🔥"],
    [/sandalia|sapato|tenis/, "👟"],
    [/filme de pvc|copo/, "🥤"],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? "🏷️";
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
