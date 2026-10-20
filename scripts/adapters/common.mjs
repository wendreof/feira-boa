// Common utilities for offer adapters, validation, and product classification.

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

export function classifyProduct(name, brand, category) {
  const text = `${name} ${brand} ${category}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const rules = [
    [/cafe/, "Café"], [/arroz/, "Arroz"], [/feijao/, "Feijão"], [/leite em po|leite uht|leite integral|leite fermentado|leite longa vida|bebida lactea/, "Leites"],
    [/condicionador|shampoo|creme dental|absorvente|sabonete|desodorante|higiene|toalha umedecida/, "Higiene pessoal"],
    [/iogurte|danoninho/, "Iogurtes"], [/requeijao|queijo|ricota/, "Queijos e requeijão"], [/manteiga|margarina/, "Manteiga"], [/mortadela|presunto/, "Frios"],
    [/frango|asa de|coxa|sobrecoxa|filezinho|chicken|sassami/, "Frango"], [/bovino|contrafile|paleta|alcatra|fraldinha|figado|acem|lombo|costela|patinho/, "Carne bovina"],
    [/linguica|salsicha|panceta|suina|suino|bacon|pernil|bisteca/, "Carnes suínas e embutidos"], [/tilapia|peixe|sardinha|atum/, "Peixes"],
    [/cerveja/, "Cervejas"], [/refrigerante|guarana|h2oh/, "Refrigerantes"], [/suco|nectar|agua mineral|agua de coco|energetico|refresco/, "Sucos e bebidas"], [/vinho|aperitivo|smirnoff|gin/, "Bebidas alcoólicas"],
    [/lava-roupas|lava roupas|sabao|detergente|amaciante|limpeza|limpador|desinfetante|saponaceo/, "Lavanderia e limpeza"], [/papel higienico|papel higiênico/, "Papel higiênico"],
    [/sorvete|acai|congelad|lasanha|ravioli|capeletti|batata palito|hamburguer|brocolis/, "Congelados"],
    [/batata chips|biscoito|chocolate|pacoquinha|bombom|wafer/, "Doces e snacks"],
    [/(?!.*pelado)tomate|batata|cebola|cenoura|alface|banana|maca|maçã|fruta|verdura|legume|abacaxi|melancia|melao|laranja|uva|alho|manga|abobora|chuchu|repolho|abobrinha|pepino|milho verde/, "Hortifruti"],
    [/macarrao|massa para|farinha|azeite|maionese|ketchup|mostarda|azeitona|seleta|milho|acucar|achocolatado|oleo soja|molho|creme de leite|leite condensado|pao de forma|cereal|filtro de papel/, "Mercearia"],
    [/racao|dog|cat|pet/, "Pet"],
    [/pilha|esponja|lixeira|pano|lampada|carvao/, "Casa"],
  ];
  const matched = rules.find(([pattern]) => pattern.test(text));
  const productType = matched ? matched[1] : category;

  const departments = {
    "Frios e laticínios": "Frios e laticínios", "Iogurtes": "Frios e laticínios", "Queijos e requeijão": "Frios e laticínios", "Manteiga": "Frios e laticínios", "Frios": "Frios e laticínios",
    "Frango": "Açougue e peixaria", "Carne bovina": "Açougue e peixaria",
    "Carnes suínas e embutidos": "Açougue e peixaria", "Peixes": "Açougue e peixaria", "Cervejas": "Bebidas",
    "Refrigerantes": "Bebidas", "Sucos e bebidas": "Bebidas", "Bebidas alcoólicas": "Bebidas",
    "Lavanderia e limpeza": "Casa e limpeza", "Papel higiênico": "Casa e limpeza", "Higiene pessoal": "Higiene e cuidados", "Doces e snacks": "Mercearia", "Hortifruti": "Hortifruti",
    "Congelados": "Congelados", "Mercearia": "Mercearia", "Café": "Mercearia", "Arroz": "Mercearia", "Feijão": "Mercearia", "Leites": "Frios e laticínios",
    "Pet": "Pet", "Casa": "Casa e limpeza",
  };
  const categoryDepartments = {
    "Carnes": "Açougue e peixaria", "Peixes": "Açougue e peixaria", "Frios": "Frios e laticínios", "Laticínios": "Frios e laticínios",
    "Limpeza": "Casa e limpeza", "Higiene": "Higiene e cuidados", "Mercearia": "Mercearia", "Bebidas": "Bebidas", "Congelados": "Congelados",
    "Pet": "Pet", "Casa": "Casa e limpeza", "Padaria": "Mercearia", "Hortifruti": "Hortifruti",
  };
  const isBarbecueProduct = /picanha|fraldinha|maminha|costela|contrafile|entrecote|ancho|linguica|pao de alho|queijo coalho|carvao|espeto|grelha|acendedor|coxa|sobrecoxa|asa de frango|bisteca|panceta/.test(text);
  const primaryProductType = productType === category ? (categoryDepartments[category] ?? category) : productType;
  return {
    department: departments[productType] ?? categoryDepartments[category] ?? category,
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
