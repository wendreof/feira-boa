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

export function assignIcon(name, productType, department) {
  const text = `${name} ${productType} ${department}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/cafe/.test(text)) return "☕";
  if (/cerveja/.test(text)) return "🍺";
  if (/vinho/.test(text)) return "🍷";
  if (/refrigerante|h2oh|energetico/.test(text)) return "🥤";
  if (/suco|nectar/.test(text)) return "🧃";
  if (/agua/.test(text)) return "💧";
  if (/leite|iogurte|requeijao|manteiga/.test(text)) return "🥛";
  if (/queijo/.test(text)) return "🧀";
  if (/arroz/.test(text)) return "🍚";
  if (/feijao/.test(text)) return "🍲";
  if (/frango|coxa|sobrecoxa|sassami/.test(text)) return "🍗";
  if (/carne|bife|costela|alcatra|acem|contrafile/.test(text)) return "🥩";
  if (/linguica|salsicha|bacon|panceta|mortadela/.test(text)) return "🌭";
  if (/peixe|sardinha|atum|tilapia/.test(text)) return "🐟";
  if (/tomate/.test(text)) return "🍅";
  if (/batata/.test(text)) return "🥔";
  if (/banana/.test(text)) return "🍌";
  if (/maca|manga|melancia|melao|laranja|uva|abacaxi/.test(text)) return "🍎";
  if (/cenoura|cebola|alho|verdura|legume|abobora|chuchu|repolho/.test(text)) return "🥦";
  if (/sabao|lava-roupas|detergente|amaciante|limpeza|desinfetante/.test(text)) return "🧺";
  if (/papel higienico|absorvente/.test(text)) return "🧻";
  if (/shampoo|condicionador|sabonete|creme/.test(text)) return "🧴";
  if (/creme dental/.test(text)) return "🪥";
  if (/biscoito|cookie|wafer/.test(text)) return "🍪";
  if (/chocolate|bombom/.test(text)) return "🍫";
  if (/sorvete|acai/.test(text)) return "🍨";
  if (/pao/.test(text)) return "🍞";
  if (/macarrao|lasanha|massa/.test(text)) return "🍝";
  if (/molho|azeite|oleo|condimento/.test(text)) return "🥫";
  if (/racao|dog|pet/.test(text)) return "🐾";
  if (/carvao|fogo/.test(text)) return "🔥";
  if (/pilha/.test(text)) return "🔋";
  return "🏷️";
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
