import { foldText } from "../../src/shared/text.mjs";

const MARINATED_MEAT_TYPES = new Set(["Carne bovina", "Carnes suínas", "Peixes", "Frango"]);

/** Names like "… Temperado" are marinated cuts, not tempero/condimento SKUs. */
function isMarinatedCounterCut(name, productType) {
  if (!MARINATED_MEAT_TYPES.has(productType)) return false;
  const text = foldText(name);
  if (/tempero\s*(para|de|completo)|sache\s+de\s+tempero|\btempero\b/.test(text) && !/temperad[oa]/.test(text)) {
    return false;
  }
  if (productType === "Frango") {
    return /frango|passarinho|asa de|coxa|sobrecoxa|sassami|filezinho|peito de frango|coracao de frango|tulipa|moela/.test(text);
  }
  return /picanha|costela|bisteca|contrafile|alcatra|maminha|fraldinha|acem|pernil|paleta|cupim|lombo|file mignon|bovin|suin|suino|tilapia|merluza|sardinha|atum|peito|figado|carre/.test(text);
}

export function assignIcon(name, productType = "", department = "") {
  const normalize = foldText;
  const nameText = normalize(name);
  const fullText = normalize(`${name} ${productType}`);
  /** @type {Array<[RegExp, string]>} */
  const rules = [
    // Higiene e limpeza primeiro: nomes como "Desinfetante Limão" ou "Repelente de Citronela" têm frutas.
    [/escova dental|creme dental|gel dental|pasta dental|fio dental|enxaguante|antisseptic|higiene bucal|plax/, "🪥"],
    [/inseticida|repelente/, "🪰"],
    [/detergente|desinfetante|saponaceo|limpador|multiuso|amaciante|lava roupa|lava-roupas|lava[ -]?loucas?|tira manchas|bloco sanitario|higienizador|limpa vidros|pastilha adesiva|sanitario|alcool|\bsabao\b|desodorizador|odorizador|odorizante|neutralizador|cloro/, "🧺"],
    [/esponja|bucha|flanela|la de aco|\bpano\b|panos/, "🧽"],
    [/lixeira|saco para lixo/, "🗑️"],
    [/pilha|bateria/, "🔋"],
    [/lampada/, "💡"],
    [/papel higienico|absorvente|fralda|toalhas? umedecidas?|papel toalha|toalha de papel|guardanapo/, "🧻"],
    [/shampoo|condicionador|leave-in|leave in|tratamento capilar|oleo capilar|creme de pentear|creme para pentear|creme multifuncional|creme de tratament|creme para tratament|creme noturno|tratamernto|reparador de pontas|serum|lustra|mascara de|sabonete|desodorante|hidratante|protetor solar|perfume|antiperspirante|difusor|aroma/, "🧴"],
    [/aparelho de barbear|barbear|depiladora/, "🪒"],
    [/suplemento|whey|creatina|aminoacido/, "💊"],

    // Mercearia e snacks: regras específicas antes das palavras genéricas.
    [/salgadinho|pringles/, "🥨"],
    [/pipoca/, "🍿"],
    [/bolinho/, "🧁"],
    [/filme de pvc|\bcopo\b/, "🥤"],
    [/tortilla chips|\bchips?\b/, "🥨"],
    [/rosquinha|donut/, "🍩"],
    [/biscoito|cookie|wafer|bolacha/, "🍪"],
    [/macarrao|lasanha|massa|ravioli|capeletti|talharim|nhoque|bolonhesa|meu menu|hot bowls/, "🍝"],
    [/panetone|tortinha|brownie|bolo|pao de mel/, "🎂"],
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
    [/pedigree|whiskas|petisco|osso|rachis|coleira|comedouro|areia sanit/, "🦴"],
    [/\bcarvao\b/, "♨️"],
    [/\bracao\b|\bracoes\b|cachorro|\bgato\b|alimento para/, "🐾"],
    [/sandalia|sapato|tenis|chinelo/, "👟"],
    [/ferro de passar/, "♨️"],
  ];
  const skipSpiceIcon = isMarinatedCounterCut(name, productType);
  for (const [pattern, icon] of rules) {
    if (skipSpiceIcon && pattern.source.includes("temper")) continue;
    if (pattern.test(nameText)) return icon;
  }
  for (const [pattern, icon] of rules) {
    if (skipSpiceIcon && pattern.source.includes("temper")) continue;
    if (pattern.test(fullText)) return icon;
  }
  return "🏷️";
}
