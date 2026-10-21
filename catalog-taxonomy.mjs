/**
 * Taxonomia de catálogo do Feira Boa.
 *
 * Os setores (grupos) e os tipos de produto (subcategorias) seguem a ordem
 * usada nos filtros e na ordenação das ofertas. A resolução acontece sobre o
 * feed atual (que mantém a taxonomia original dos adaptadores) e devolve o
 * grupo e a subcategoria de cada oferta.
 */

/** @typedef {{ id: string, label: string, subcategories: string[] }} TaxonomyGroup */
/** @typedef {{ groupId: string, subcategory: string }} CatalogCategory */
/** @typedef {{ id: string, label: string }} HighlightTab */

/** @type {TaxonomyGroup[]} */
export const TAXONOMY_GROUPS = [
  {
    id: "frescos",
    label: "Alimentos frescos",
    subcategories: [
      "Açougue e carnes frescas",
      "Aves",
      "Peixaria e frutos do mar",
      "Laticínios e ovos",
      "Frios e embutidos",
      "Padaria e confeitaria",
      "Hortifruti",
    ],
  },
  {
    id: "mercearia",
    label: "Mercearia",
    subcategories: [
      "Mercearia básica",
      "Café da manhã e matinais",
      "Doces e chocolates",
      "Enlatados e conservas",
      "Temperos e condimentos",
      "Biscoitos e snacks",
      "Massas e molhos",
    ],
  },
  {
    id: "bebidas",
    label: "Bebidas",
    subcategories: [
      "Bebidas alcoólicas",
      "Bebidas sem álcool",
      "Sucos",
      "Refrigerantes",
      "Energéticos e isotônicos",
      "Chás e cafés",
      "Águas",
    ],
  },
  {
    id: "congelados",
    label: "Congelados e refeições",
    subcategories: ["Congelados", "Pratos prontos e rotisseria", "Salgados e pizzas", "Sobremesas geladas"],
  },
  {
    id: "saudaveis",
    label: "Saudáveis e dietéticos",
    subcategories: [
      "Produtos naturais",
      "Produtos integrais",
      "Produtos orgânicos",
      "Produtos sem glúten",
      "Produtos sem lactose",
      "Produtos veganos",
      "Produtos diet e sem açúcar",
      "Suplementos alimentares",
    ],
  },
  {
    id: "limpeza",
    label: "Limpeza",
    subcategories: ["Limpeza doméstica", "Lavanderia", "Acessórios de limpeza", "Inseticidas e repelentes"],
  },
  {
    id: "higiene",
    label: "Higiene e beleza",
    subcategories: [
      "Higiene pessoal",
      "Cuidados com cabelo",
      "Cuidados com a pele",
      "Higiene bucal",
      "Barbear e depilação",
      "Proteção solar",
    ],
  },
  {
    id: "infantil",
    label: "Bebês e infantil",
    subcategories: ["Fraldas", "Lenços umedecidos", "Higiene infantil", "Alimentação infantil", "Fórmulas infantis"],
  },
  {
    id: "pet",
    label: "Pet shop",
    subcategories: ["Ração para cães", "Ração para gatos", "Petiscos", "Areia sanitária", "Higiene animal", "Acessórios para pets"],
  },
  {
    id: "casa",
    label: "Casa e utilidades",
    subcategories: [
      "Bazar e utilidades domésticas",
      "Utensílios de cozinha",
      "Descartáveis",
      "Papel higiênico e papel-toalha",
      "Pilhas e lâmpadas",
      "Organização doméstica",
    ],
  },
  {
    id: "churrasco",
    label: "Churrasco e festas",
    subcategories: ["Carnes para churrasco", "Carvão e acendedores", "Temperos para churrasco", "Produtos para festas", "Descartáveis para festas", "Produtos sazonais"],
  },
  {
    id: "vestuario",
    label: "Vestuário e calçados",
    subcategories: ["Calçados", "Vestuário"],
  },
  { id: "outros", label: "Outros", subcategories: ["Outros"] },
];

export const ALL_SECTORS_LABEL = "Todos os setores";

/** @type {HighlightTab[]} */
export const HIGHLIGHT_TABS = [
  { id: "all", label: "Todas as ofertas" },
  { id: "deals-today", label: "Ofertas do dia" },
  { id: "promos", label: "Promoções" },
  { id: "new", label: "Novidades" },
  { id: "top-rated", label: "Mais curtidos" },
  { id: "combos", label: "Combos e kits" },
  { id: "own-brand", label: "Marcas próprias" },
  { id: "buy-again", label: "Comprar novamente" },
];

/** @type {Record<string, CatalogCategory>} */
const TYPE_CATEGORY = {
  Hortifruti: { groupId: "frescos", subcategory: "Hortifruti" },
  "Carne bovina": { groupId: "frescos", subcategory: "Açougue e carnes frescas" },
  "Carnes suínas": { groupId: "frescos", subcategory: "Açougue e carnes frescas" },
  "Açougue e peixaria": { groupId: "frescos", subcategory: "Açougue e carnes frescas" },
  Frango: { groupId: "frescos", subcategory: "Aves" },
  Peixes: { groupId: "frescos", subcategory: "Peixaria e frutos do mar" },
  Frios: { groupId: "frescos", subcategory: "Frios e embutidos" },
  "Frios e laticínios": { groupId: "frescos", subcategory: "Frios e embutidos" },
  Leites: { groupId: "frescos", subcategory: "Laticínios e ovos" },
  Iogurtes: { groupId: "frescos", subcategory: "Laticínios e ovos" },
  "Queijos e requeijão": { groupId: "frescos", subcategory: "Laticínios e ovos" },
  Manteiga: { groupId: "frescos", subcategory: "Laticínios e ovos" },
  Ovos: { groupId: "frescos", subcategory: "Laticínios e ovos" },
  Arroz: { groupId: "mercearia", subcategory: "Mercearia básica" },
  Feijão: { groupId: "mercearia", subcategory: "Mercearia básica" },
  Mercearia: { groupId: "mercearia", subcategory: "Mercearia básica" },
  "Doces e snacks": { groupId: "mercearia", subcategory: "Doces e chocolates" },
  Café: { groupId: "bebidas", subcategory: "Chás e cafés" },
  Refrigerantes: { groupId: "bebidas", subcategory: "Refrigerantes" },
  "Sucos e bebidas": { groupId: "bebidas", subcategory: "Sucos" },
  Cervejas: { groupId: "bebidas", subcategory: "Bebidas alcoólicas" },
  "Bebidas alcoólicas": { groupId: "bebidas", subcategory: "Bebidas alcoólicas" },
  Bebidas: { groupId: "bebidas", subcategory: "Bebidas sem álcool" },
  Congelados: { groupId: "congelados", subcategory: "Congelados" },
  "Lavanderia e limpeza": { groupId: "limpeza", subcategory: "Lavanderia" },
  "Casa e limpeza": { groupId: "limpeza", subcategory: "Limpeza doméstica" },
  "Higiene pessoal": { groupId: "higiene", subcategory: "Higiene pessoal" },
  "Papel higiênico": { groupId: "casa", subcategory: "Papel higiênico e papel-toalha" },
  Casa: { groupId: "casa", subcategory: "Bazar e utilidades domésticas" },
  Pet: { groupId: "pet", subcategory: "Ração para cães" },
  Calçados: { groupId: "vestuario", subcategory: "Calçados" },
  Outros: { groupId: "outros", subcategory: "Outros" },
};

/** Tipos genéricos: quando o tipo não diz nada, as palavras do produto definem a categoria. */
const GENERIC_TYPES = new Set([
  "Mercearia", "Arroz", "Feijão", "Café", "Congelados", "Doces e snacks", "Bebidas", "Bebidas alcoólicas",
  "Sucos e bebidas", "Refrigerantes", "Cervejas", "Casa", "Casa e limpeza", "Lavanderia e limpeza",
  "Higiene pessoal", "Papel higiênico", "Pet", "Frios e laticínios", "Outros",
]);

/** Regras de grupo por palavra do produto. */
const GROUP_KEYWORD_RULES = [
  { re: /fralda/, groupId: "infantil" },
  { re: /lenco umedecido|papel umedecido|lenho umedecido|toalha umedecida/, groupId: "infantil" },
  { re: /formula infantil|leite infantil/, groupId: "infantil" },
  { re: /papinha|alimentacao infantil|food infantil/, groupId: "infantil" },
  { re: /racao|petisco|areia sanit|antipulgas|higiene animal|coleira|comedouro/, groupId: "pet" },
  { re: /organico|orgânico|sem gluten|sem glúten|gluten free|sem lactose|vegano|vegetariano|diet\b|light\b|hipocalorico|suplemento|vitamina|whey|creatina/, groupId: "saudaveis", genericOnly: true },
  { re: /integral/, groupId: "saudaveis", genericOnly: true },
  { re: /agua mineral|agua de coco|agua gaseificada|h2o/, groupId: "bebidas" },
  { re: /energetico|energético|isotonico|isotônico/, groupId: "bebidas" },
  { re: /cha mate|cha verde|cha preto/, groupId: "bebidas" },
  { re: /pizza|salgado|pao de queijo|coxinha/, groupId: "congelados", excludeTypes: ["Doces e snacks"] },
  { re: /sorvete|picole|picolé|gelato/, groupId: "congelados" },
  { re: /pao |pao de|pães|padaria|bread|bolo|croissant|rosquinha|torra/, groupId: "frescos", genericOnly: true },
  { re: /inseticida|repelente|insecticida|mosquito/, groupId: "limpeza" },
  { re: /esponja|lixeira|escorecedor|pano de|agua sanitaria|desinfetante|sabao|detergente|amaciante|limpador/, groupId: "limpeza" },
];

/** Palavras que indicam que o produto é mesmo de churrasco. */
const CHURRASCO_KEYWORDS = /carne|picanha|costela|linguica|bacon|presunto|frango|asa de|sobrecoxa|coxa|file mignon|filé mignon|alcatra|bisteca|costelinha|carvao para|carvao de|carvão para|churrasco|espeto|grelha|pao de alho|queijo coalho|molho barbecue|pasta de churrasco/;

/** Produtos que só citam uma palavra de churrasco, mas não são de churrasco. */
const NOT_CHURRASCO = /salgadinho|biscoito|bolacha|chip|chocolate|requeijao|requeijão|doce|petisco|cerveja|refrigerante|achocolatado|creme dental|dental|bucal/;

/** Regras de subcategoria por grupo. */
const SUBCATEGORY_RULES = {
  frescos: [[/pao |pao de|pães|padaria|bread|bolo|croissant|rosquinha|torra/, "Padaria e confeitaria"]],
  mercearia: [
    [/macarrao|massa|molho/, "Massas e molhos"],
    [/atum|sardinha|conserva|leite condensado|oleo de soja/, "Enlatados e conservas"],
    [/tempero|condimento|azeite|pimenta|caldo|shoyu|vinagre/, "Temperos e condimentos"],
    [/cereal|granola|muesli|pacoca|achocolatado|nescau/, "Café da manhã e matinais"],
    [/biscoito|bolacha|wafer|salgadinho|chips|cookie/, "Biscoitos e snacks"],
    [/chocolate|bombom|caramelo|recheio|bala|pirulito/, "Doces e chocolates"],
  ],
  bebidas: [
    [/agua mineral|agua de coco|agua gaseificada|h2o/, "Águas"],
    [/energetico|energético|isotonico|isotônico/, "Energéticos e isotônicos"],
    [/cerveja|vinho|aperitivo|espumante/, "Bebidas alcoólicas"],
    [/cha mate|cha verde|cafe/, "Chás e cafés"],
  ],
  congelados: [
    [/sorvete|picole|picolé|gelato/, "Sobremesas geladas"],
    [/pizza|salgado|pao de queijo|coxinha/, "Salgados e pizzas"],
    [/prato pronto|lasanha|nugget|empanado|macarrao congelado|congelado de bandeja/, "Pratos prontos e rotisseria"],
  ],
  saudaveis: [
    [/integral/, "Produtos integrais"],
    [/organico|orgânico/, "Produtos orgânicos"],
    [/sem gluten|sem glúten|gluten free/, "Produtos sem glúten"],
    [/sem lactose/, "Produtos sem lactose"],
    [/vegano|vegetariano/, "Produtos veganos"],
    [/diet|light|zero|sem acucar|sem açúcar/, "Produtos diet e sem açúcar"],
    [/suplemento|vitamina|creatina|whey|proteina|amino/, "Suplementos alimentares"],
    [/natural/, "Produtos naturais"],
  ],
  limpeza: [
    [/inseticida|repelente|insecticida|mosquito/, "Inseticidas e repelentes"],
    [/lava roupa|lava-roupas|tinturaria|alcool|amaciante|desodorizador automatico|desodorizador de roupa|sabao em po|sabao em barra/, "Lavanderia"],
    [/esponja|lixeira|pano|escorecedor/, "Acessórios de limpeza"],
    [/detergente|sabao|desinfetante|agua sanitaria|multiuso|limpa/, "Limpeza doméstica"],
  ],
  higiene: [
    [/shampoo|condicionador/, "Cuidados com cabelo"],
    [/pasta de dente|escova dental|antisseptico|higiene bucal|creme dental|enxaguante bucal|bucal|plax/, "Higiene bucal"],
    [/barbear|depilacao|maquina de cortar/, "Barbear e depilação"],
    [/protetor solar|filtro solar/, "Proteção solar"],
    [/creme|hidratante|desodorante|perfume|maquiagem/, "Cuidados com a pele"],
  ],
  infantil: [
    [/fralda/, "Fraldas"],
    [/lenco umedecido|papel umedecido|lenho umedecido|toalha umedecida/, "Lenços umedecidos"],
    [/formula infantil|leite infantil/, "Fórmulas infantis"],
    [/papinha|alimentacao infantil|food infantil/, "Alimentação infantil"],
  ],
  pet: [
    [/gato/, "Ração para gatos"],
    [/racao/, "Ração para cães"],
    [/petisco/, "Petiscos"],
    [/areia sanit/, "Areia sanitária"],
    [/higiene animal|antipulgas/, "Higiene animal"],
  ],
  casa: [
    [/papel higienico|papel toalha|guardanapo/, "Papel higiênico e papel-toalha"],
    [/descartavel|filme|aluminio|saco/, "Descartáveis"],
    [/pilha|lampada|lâmpada/, "Pilhas e lâmpadas"],
    [/panela|frigideira|garrafa termica|utensilio|espátula|tabela de corte/, "Utensílios de cozinha"],
    [/organizador|arara|cesto|gaveta|caixa/, "Organização doméstica"],
  ],
  churrasco: [
    [/carvao|carvão|acendedor|lenha/, "Carvão e acendedores"],
    [/molho|tempero|alho|barbecue|pasta de churrasco/, "Temperos para churrasco"],
    [/carne|picanha|costela|linguica|bacon|presunto|frango|file mignon|alcatra|bisteca|asa/, "Carnes para churrasco"],
    [/festa|vela|champanhe|taça|decoracao/, "Produtos para festas"],
  ],
  vestuario: [[/calcado|calçato|sapato|tênis|tenis|chinelo|sandalia/, "Calçados"]],
};

const GROUP_ORDER = new Map(TAXONOMY_GROUPS.map((group, index) => [group.id, index]));
const GROUP_BY_ID = new Map(TAXONOMY_GROUPS.map((group) => [group.id, group]));

/** @param {string} text */
function normalizeText(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * @param {string} groupId
 * @param {string} text
 * @returns {string | null}
 */
function pickSubcategory(groupId, text) {
  const rules = SUBCATEGORY_RULES[groupId];
  if (!rules) return null;
  for (const [pattern, subcategory] of rules) {
    if (pattern.test(text)) return subcategory;
  }
  return null;
}

/**
 * Resolve grupo e subcategoria de uma oferta.
 * @param {{ name?: string, brand?: string, productType?: string, productTypes?: string[] }} offer
 * @returns {CatalogCategory}
 */
export function resolveCategory(offer) {
  const text = normalizeText(`${offer?.name ?? ""} ${offer?.brand ?? ""}`);
  const types = Array.isArray(offer?.productTypes) ? offer.productTypes.filter(Boolean) : [];
  const baseType = types[0] ?? offer?.productType ?? "";
  const generic = GENERIC_TYPES.has(baseType);

  if (types.includes("Churrasco") && baseType !== "Doces e snacks" && CHURRASCO_KEYWORDS.test(text) && !NOT_CHURRASCO.test(text)) {
    return { groupId: "churrasco", subcategory: pickSubcategory("churrasco", text) ?? "Carnes para churrasco" };
  }

  for (const rule of GROUP_KEYWORD_RULES) {
    if (rule.genericOnly && !generic) continue;
    if (rule.excludeTypes?.includes(baseType)) continue;
    if (!rule.re.test(text)) continue;
    const subcategory = pickSubcategory(rule.groupId, text);
    if (subcategory) return { groupId: rule.groupId, subcategory };
  }

  const mapped = TYPE_CATEGORY[baseType] ?? TYPE_CATEGORY[offer?.productType ?? ""] ?? { groupId: "outros", subcategory: "Outros" };
  const refined = pickSubcategory(mapped.groupId, text);
  return { groupId: mapped.groupId, subcategory: refined ?? mapped.subcategory };
}

/**
 * @param {CatalogCategory} category
 * @returns {[number, number]}
 */
export function categoryOrder(category) {
  const groupIndex = GROUP_ORDER.get(category.groupId) ?? TAXONOMY_GROUPS.length;
  const group = GROUP_BY_ID.get(category.groupId);
  const subIndex = group ? group.subcategories.indexOf(category.subcategory) : -1;
  return [groupIndex, subIndex === -1 ? 0 : subIndex];
}

/**
 * @param {CatalogCategory} category
 * @returns {string}
 */
export function categoryLabel(category) {
  return GROUP_BY_ID.get(category.groupId)?.label ?? "Outros";
}

const OWN_BRAND_TOKENS = [
  { store: "Pague Menos", tokens: ["paguemenos", "paguemenos", "tenda"] },
  { store: "Supermercado Corso", tokens: ["corso"] },
  { store: "Sempre Vale", tokens: ["semprevale"] },
  { store: "Big Bom", tokens: ["bigbom"] },
  { store: "Spasso Sabores", tokens: ["spasso"] },
];

/**
 * @param {{ brand?: string, store?: string }} offer
 * @returns {boolean}
 */
export function isOwnBrand(offer) {
  const brand = normalizeText(offer?.brand ?? "").replace(/\s+/g, "");
  if (!brand) return false;
  const entry = OWN_BRAND_TOKENS.find((item) => item.store === offer?.store);
  if (!entry) return false;
  return entry.tokens.some((token) => brand.includes(token));
}

/**
 * Desconto percentual da oferta (0 quando não há preço anterior).
 * @param {{ price: number, previousPrice: number | null }} offer
 */
export function discountRatio(offer) {
  if (!offer.previousPrice || offer.previousPrice <= offer.price) return 0;
  return (offer.previousPrice - offer.price) / offer.previousPrice;
}

/**
 * @param {string} today data no formato YYYY-MM-DD
 * @param {number} days
 */
function daysBefore(today, days) {
  const date = new Date(`${today}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Aplica uma aba de destaque sobre a lista de ofertas.
 * @template {{ id: string, name: string, brand?: string, store?: string, price: number, previousPrice: number | null, validFrom: string }} T
 * @param {T[]} offers
 * @param {string} tabId
 * @param {{ today?: string, viewedIds?: string[], likes?: Map<string, number> }} [context]
 * @returns {T[]}
 */
export function applyHighlightTab(offers, tabId, context = {}) {
  const today = context.today ?? "";
  const viewed = new Set(context.viewedIds ?? []);
  const likes = context.likes ?? new Map();
  switch (tabId) {
    case "deals-today":
      return offers.filter((offer) => Boolean(today) && offer.validFrom >= today).sort((a, b) => (a.validFrom === b.validFrom ? 0 : a.validFrom < b.validFrom ? 1 : -1));
    case "promos":
      return offers.filter((offer) => discountRatio(offer) > 0).sort((a, b) => discountRatio(b) - discountRatio(a));
    case "new":
      return offers.filter((offer) => !today || offer.validFrom >= daysBefore(today, 3)).sort((a, b) => (a.validFrom === b.validFrom ? 0 : a.validFrom < b.validFrom ? 1 : -1));
    case "top-rated":
      return [...offers].sort((a, b) => (likes.get(b.id) ?? 0) - (likes.get(a.id) ?? 0));
    case "combos":
      return offers.filter((offer) => /combo|kit|pack/i.test(offer.name));
    case "own-brand":
      return offers.filter((offer) => isOwnBrand(offer));
    case "buy-again":
      return offers.filter((offer) => viewed.has(offer.id));
    default:
      return offers;
  }
}
