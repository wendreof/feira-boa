import { foldText } from "../../shared/text.mjs";

/** @type {Array<[RegExp, string]>} */
const PRODUCT_TYPE_RULES = [
  [/\b(sabao em po|detergente|amaciante|agua sanitaria|saponaceo|desinfetante|multiuso)\b/, "Lavanderia e limpeza"],
  [/\b(condicionador|shampoo|leave in|leave-in|creme leave in|creme de pentear|mascara capilar|oleo capilar|reparador de pontas|tratamento capilar|serum capilar|creme dental|pasta de dente|escova dental|fio dental|enxaguante|antisseptico|higiene bucal|absorvente|sabonete|desodorante|antiperspirante|protetor solar|perfume|maquiagem|barbear|depiladora|toalha umedecida)\b/, "Higiene pessoal"],
  [/\b(biscoito|bolacha|wafer|cookie|salgadinho|pringles|chips?|batata palha|chocolate|bombom|pacoquinha|doce de leite|pirulito|caramelo|goiabada|bala|chiclete|creme de avela|creme avela|nutella|avela)\b/, "Doces e snacks"],
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
  [/\b(macarrao|massa seca|espaguete|talharim|parafuso|aveludinhos?|festone|canudone)\b/, "Mercearia"],
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
  return foldText(value);
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
