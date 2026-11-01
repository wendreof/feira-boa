import assert from "node:assert/strict";
import test from "node:test";
import { assignIcon } from "../scripts/domain/icons.mjs";
import { classifyProduct } from "../scripts/domain/taxonomy.mjs";
import { fetchWithRetry } from "../scripts/adapters/http.mjs";
import { normalizeOfferNote } from "../scripts/domain/offer-note.mjs";
import { normalizeOfferPresentation } from "../scripts/domain/presentation.mjs";
import { parseDateRange, parsePrice } from "../scripts/domain/parsing.mjs";
import { validateOffer, validateSnapshot } from "../scripts/domain/validation.mjs";
import { slugText as slug } from "../src/shared/text.mjs";
import { buildPagueMenosOffer, getWeekValidity } from "../scripts/adapters/paguemenos.mjs";

test("parseDateRange handles various Brazilian flyer date formats", () => {
  const d1 = parseDateRange("Ofertas válidas de 19/10 até 21/10/2026");
  assert.deepEqual(d1, { from: "2026-10-19", to: "2026-10-21" });

  const d2 = parseDateRange("OFERTAS VÁLIDAS DE 19 A 22 DE OUTUBRO DE 2026");
  assert.deepEqual(d2, { from: "2026-10-19", to: "2026-10-22" });

  const d3 = parseDateRange("DE 19 A 21/10/2026");
  assert.deepEqual(d3, { from: "2026-10-19", to: "2026-10-21" });

  const d4 = parseDateRange("19 a 21 de out.", 2026);
  assert.deepEqual(d4, { from: "2026-10-19", to: "2026-10-21" });

  const d5 = parseDateRange("30 de outubro a 02 de novembro de 2026");
  assert.deepEqual(d5, { from: "2026-10-30", to: "2026-11-02" });

  assert.equal(parseDateRange(""), null);
  assert.equal(parseDateRange("sem data"), null);
});

test("fetchWithRetry retries transient failures but not permanent ones", async () => {
  const originalFetch = globalThis.fetch;
  let transientCalls = 0;
  globalThis.fetch = async () => {
    transientCalls += 1;
    return new Response("", { status: transientCalls < 3 ? 503 : 200 });
  };
  try {
    const response = await fetchWithRetry("https://example.com/transient", {}, { delayMs: 1 });
    assert.equal(response.status, 200);
    assert.equal(transientCalls, 3);

    let permanentCalls = 0;
    globalThis.fetch = async () => {
      permanentCalls += 1;
      return new Response("", { status: 404 });
    };
    const missing = await fetchWithRetry("https://example.com/missing", {}, { delayMs: 1 });
    assert.equal(missing.status, 404);
    assert.equal(permanentCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parsePrice converts Brazilian real strings to numbers", () => {
  assert.equal(parsePrice("R$ 14 ,98"), 14.98);
  assert.equal(parsePrice("R$15,90"), 15.90);
  assert.equal(parsePrice("R$ 2,39"), 2.39);
  assert.equal(parsePrice("10,00"), 10.00);
  assert.equal(parsePrice(12.5), 12.5);
  assert.equal(parsePrice("invalido"), null);
});

test("slug generates URL-safe normalized identifiers", () => {
  assert.equal(slug("Café Melitta 500g 2026-10-19"), "cafe-melitta-500g-2026-10-19");
  assert.equal(slug("Picanha Friboi / Peça"), "picanha-friboi-peca");
});

test("classifyProduct maps products to departments and product types", () => {
  const beef = classifyProduct("Costela Bovina", "Carnes");
  assert.equal(beef.department, "Açougue e peixaria");
  assert.equal(beef.productType, "Carne bovina");
  assert.ok(beef.productTypes.includes("Churrasco"));

  const milk = classifyProduct("Leite Longa Vida Líder 1L", "Laticínios");
  assert.equal(milk.department, "Frios e laticínios");
  assert.equal(milk.productType, "Leites");

  const detergent = classifyProduct("Lava Roupas OMO", "Limpeza");
  assert.equal(detergent.department, "Casa e limpeza");
  assert.equal(detergent.productType, "Lavanderia e limpeza");

  const eggs = classifyProduct("Ovos Vermelhos São Caipira 10un", "Geral");
  assert.equal(eggs.department, "Mercearia");
  assert.equal(eggs.productType, "Ovos");

  const sandals = classifyProduct("Sandália Ipanema Clássica", "Geral");
  assert.equal(sandals.department, "Vestuário e calçados");
  assert.equal(sandals.productType, "Calçados");

  const kettle = classifyProduct("Feirinha New Fort Flon", "Geral");
  assert.equal(kettle.department, "Casa e limpeza");
  assert.equal(kettle.productType, "Casa");

  const hazelnut = classifyProduct("Creme Avelã Nutella 140g", "Geral");
  assert.equal(hazelnut.department, "Mercearia");
  assert.equal(hazelnut.productType, "Doces e snacks");

  const unknown = classifyProduct("Produto sem categoria", "Geral");
  assert.equal(unknown.department, "Outros");
  assert.equal(unknown.productType, "Outros");
});

test("classifyProduct keeps embutidos out of the meat categories", () => {
  const sausage = classifyProduct("Linguiça Calabresa Sadia Defumada Cozida", "Carnes");
  assert.equal(sausage.department, "Frios e laticínios");
  assert.equal(sausage.productType, "Frios");

  const ham = classifyProduct("Presunto Sadia Cozido Fatiado", "Frios");
  assert.equal(ham.department, "Frios e laticínios");
  assert.equal(ham.productType, "Frios");

  const bacon = classifyProduct("Bacon Defumado Sadia em Fatias", "Carnes");
  assert.equal(bacon.department, "Frios e laticínios");
  assert.equal(bacon.productType, "Frios");

  const pork = classifyProduct("Filé Mignon Suíno Sadia em Bifes", "Carnes");
  assert.equal(pork.department, "Açougue e peixaria");
  assert.equal(pork.productType, "Carnes suínas");

  const baconFlavor = classifyProduct("Ketchup Heinz Bacon com Cebola Caramelizada", "Mercearia");
  assert.equal(baconFlavor.department, "Mercearia");
  assert.equal(baconFlavor.productType, "Mercearia");
});

test("buildPagueMenosOffer maps catalog products and skips unavailable items", () => {
  const product = {
    productName: "Café Melitta Regiões Brasileiras Sul de Minas 250g",
    brand: "Melitta",
    categories: ["/Mercearia/Café e Achocolatados/Café/"],
    items: [{
      sellers: [{
        sellerDefault: true,
        commertialOffer: { Price: 24.99, ListPrice: 25.99, IsAvailable: true },
      }],
    }],
  };
  const validity = { from: "2026-10-19", to: "2026-10-25" };
  const offer = buildPagueMenosOffer(product, { validity });

  assert.equal(offer.name, "Café Melitta Regiões Brasileiras Sul de Minas");
  assert.ok(!("brand" in offer), "brand must live inside the name");
  assert.equal(offer.detail, "250g");
  assert.equal(offer.price, 24.99);
  assert.equal(offer.previousPrice, 25.99);
  assert.equal(offer.department, "Mercearia");
  assert.equal(offer.productType, "Café");
  assert.equal(offer.validFrom, "2026-10-19");
  assert.equal(offer.validTo, "2026-10-25");
  assert.match(offer.id, /^paguemenos-cafe-melitta/);

  const unavailable = { ...product, items: [{ sellers: [{ sellerDefault: true, commertialOffer: { Price: 24.99, IsAvailable: false } }] }] };
  assert.equal(buildPagueMenosOffer(unavailable, { validity }), null);
  const free = { ...product, items: [{ sellers: [{ sellerDefault: true, commertialOffer: { Price: 0, IsAvailable: true } }] }] };
  assert.equal(buildPagueMenosOffer(free, { validity }), null);
});

test("getWeekValidity uses a stable Monday-Sunday window in São Paulo", () => {
  assert.deepEqual(
    getWeekValidity(new Date("2026-10-20T12:00:00Z")),
    { from: "2026-10-19", to: "2026-10-25" },
  );
  assert.deepEqual(
    getWeekValidity(new Date("2026-10-25T12:00:00Z")),
    { from: "2026-10-19", to: "2026-10-25" },
  );
  assert.deepEqual(
    getWeekValidity(new Date("2026-10-26T12:00:00Z")),
    { from: "2026-10-26", to: "2026-11-01" },
  );
});

test("buildPagueMenosOffer extracts package details and maps catalog categories", () => {
  const validity = { from: "2026-10-19", to: "2026-10-25" };
  const product = (productName, categories = ["/Perfumaria/"]) => ({
    productName,
    brand: "",
    categories,
    items: [{ sellers: [{ sellerDefault: true, commertialOffer: { Price: 9.99, ListPrice: 9.99, IsAvailable: true } }] }],
  });

  const floss = buildPagueMenosOffer(product("Fio Dental Colgate Menta 50m"), { validity });
  assert.equal(floss.name, "Fio Dental Colgate Menta");
  assert.equal(floss.detail, "50m");

  const cleaner = buildPagueMenosOffer(product("Limpador Sanitário Bloco Higiênico Harpic Lavanda Unidade"), { validity });
  assert.equal(cleaner.name, "Limpador Sanitário Bloco Higiênico Harpic Lavanda");
  assert.equal(cleaner.detail, "Unidade");

  const capsules = buildPagueMenosOffer(product("Cápsula Pilão Espresso 12 com 20 Unidades", ["/Mercearia/"]), { validity });
  assert.equal(capsules.name, "Cápsula Pilão Espresso 12");
  assert.equal(capsules.detail, "20 Unidades");

  const cosmetic = buildPagueMenosOffer(product("Espuma de Barbear Hidratante"), { validity });
  assert.equal(cosmetic.department, "Higiene e cuidados");
  assert.equal(cosmetic.productType, "Higiene pessoal");
});

test("assignIcon assigns appropriate emojis to products", () => {
  assert.equal(assignIcon("Café Solúvel", "Café", "Mercearia"), "☕");
  assert.equal(assignIcon("Cerveja Lata", "Cervejas", "Bebidas"), "🍺");
  assert.equal(assignIcon("Sabão OMO", "Lavanderia e limpeza", "Casa e limpeza"), "🧺");
  assert.equal(assignIcon("Costela", "Carne bovina", "Açougue e peixaria"), "🥩");
  assert.equal(assignIcon("Alface", "Hortifruti", "Hortifruti"), "🥬");
  assert.equal(assignIcon("Repolho Verde", "Hortifruti", "Hortifruti"), "🥬");
  assert.equal(assignIcon("Brócolis Japonês", "Congelados", "Congelados"), "🥦");
  assert.equal(assignIcon("Cenoura", "Hortifruti", "Hortifruti"), "🥕");
  assert.equal(assignIcon("Macarrão Instantâneo", "Mercearia", "Mercearia"), "🍝");
  assert.equal(assignIcon("Papel Higiênico", "Papel higiênico", "Casa e limpeza"), "🧻");
  assert.equal(assignIcon("Pilha Alcalina", "Casa", "Casa e limpeza"), "🔋");
});

test("assignIcon prefers the product name over the product type", () => {
  assert.equal(assignIcon("Agua de Coco", "Sucos e bebidas", "Bebidas"), "🥥");
  assert.equal(assignIcon("Agua Mineral", "Sucos e bebidas", "Bebidas"), "💧");
  assert.equal(assignIcon("Salgadinho de Batata Creme de Cebola", "Doces e snacks", "Mercearia"), "🥨");
  assert.equal(assignIcon("Ketchup Bacon com Cebola", "Mercearia", "Mercearia"), "🥫");
  assert.equal(assignIcon("Lasanha Bolonhesa", "Congelados", "Congelados"), "🍝");
  assert.equal(assignIcon("Hamburguer Bovino na Brasa Picanha", "Carne bovina", "Açougue e peixaria"), "🍔");
  assert.equal(assignIcon("Shampoo Reparacao Total 5", "Higiene pessoal", "Higiene e cuidados"), "🧴");
  assert.equal(assignIcon("Coracao de Frango Congelado", "Congelados", "Congelados"), "🍗");
  assert.equal(assignIcon("Desinfetante Limão", "Lavanderia e limpeza", "Casa e limpeza"), "🧺");
  assert.equal(assignIcon("Escova Dental Carvão", "Higiene pessoal", "Higiene e cuidados"), "🪥");
  assert.equal(assignIcon("Refrigerante Zero Açúcar", "Refrigerantes", "Bebidas"), "🥤");
  assert.equal(assignIcon("Tempero para Airfryer Frango", "Frango", "Açougue e peixaria"), "🧂");
});

test("assignIcon separates beef from pork", () => {
  assert.equal(assignIcon("Contrafilé bovino", "Carne bovina", "Açougue e peixaria"), "🥩");
  assert.equal(assignIcon("Costela Bovina", "Carne bovina", "Açougue e peixaria"), "🥩");
  assert.equal(assignIcon("Ponta de alcatra bovina", "Carne bovina", "Açougue e peixaria"), "🥩");
  assert.equal(assignIcon("Filé Mignon Suíno em Bifes", "Carnes suínas", "Açougue e peixaria"), "🐖");
  assert.equal(assignIcon("Pernil suíno resfriado com osso", "Carnes suínas", "Açougue e peixaria"), "🐖");
  assert.equal(assignIcon("Bisteca Suína", "Carnes suínas", "Açougue e peixaria"), "🐖");
  assert.equal(assignIcon("Costelinha suína congelada", "Carnes suínas", "Açougue e peixaria"), "🐖");
  assert.equal(assignIcon("Filé de Peito de Frango", "Frango", "Açougue e peixaria"), "🍗");
});

test("assignIcon gives each deli item its own icon", () => {
  assert.equal(assignIcon("Bacon Defumado Sadia em Fatias", "Frios", "Frios e laticínios"), "🥓");
  assert.equal(assignIcon("Linguiça Calabresa Sadia Defumada Cozida", "Frios", "Frios e laticínios"), "🌭");
  assert.equal(assignIcon("Salsicha Sadia Hot Dog", "Frios", "Frios e laticínios"), "🫔");
  assert.equal(assignIcon("Mortadela Defumada Sadia", "Frios", "Frios e laticínios"), "🍖");
  assert.equal(assignIcon("Presunto Sadia Cozido Fatiado", "Frios", "Frios e laticínios"), "🍖");
  assert.equal(assignIcon("Ketchup Bacon com Cebola Caramelizada", "Mercearia", "Mercearia"), "🥫");
});

test("normalizeOfferPresentation keeps the brand inside the product name", () => {
  const chicken = normalizeOfferPresentation({
    name: "COXA C/ SOBRECOXA DE FRANGO AVELÍCIA",
    brand: "",
    detail: "PCT KG",
    note: "",
  });
  assert.equal(chicken.name, "Coxa c/ Sobrecoxa de Frango Avelícia");
  assert.ok(!("brand" in chicken), "brand must live inside the name");

  const rice = normalizeOfferPresentation({
    name: "Arroz SÃO LUCAS ou SELETTO Tipo 1",
    brand: "",
    detail: "5kg",
    note: "",
  });
  assert.equal(rice.name, "Arroz São Lucas ou Seletto Tipo 1");
  assert.ok(!("brand" in rice), "brand must live inside the name");

  const duplicate = normalizeOfferPresentation({
    name: "Sabão Em Pó Omo Expert Branco Absoluto",
    brand: "OMO",
    detail: "720g",
    note: "",
  });
  assert.equal(duplicate.name, "Sabão em Pó Omo Expert Branco Absoluto");
  assert.ok(!("brand" in duplicate), "brand must live inside the name");

  const separate = normalizeOfferPresentation({
    name: "Lasanha",
    brand: "Seara",
    detail: "600 g",
    note: "",
  });
  assert.equal(separate.name, "Lasanha Seara", "a separate brand joins the name");
  assert.ok(!("brand" in separate), "brand must live inside the name");

  const accentedBrand = normalizeOfferPresentation({
    name: "Café Pilão Tradicional 500g",
    brand: "Pilao",
    detail: "500g",
    note: "",
  });
  assert.equal(accentedBrand.name, "Café Pilão Tradicional");
  assert.equal(accentedBrand.detail, "500g");
  assert.ok(!("brand" in accentedBrand), "brand must live inside the name");

  const apostropheBrand = normalizeOfferPresentation({
    name: "Salgadinho de Batata Lay's Clássica",
    brand: "Lays",
    detail: "115g",
    note: "",
  });
  assert.equal(apostropheBrand.name, "Salgadinho de Batata Lay's Clássica");
  assert.ok(!("brand" in apostropheBrand), "brand must live inside the name");

  const dated = normalizeOfferPresentation({
    name: "19 A 21 DE OUT. ÓLEO SOJA VITALIV",
    brand: "",
    detail: "900ML",
    note: "",
  });
  assert.equal(dated.name, "Óleo Soja Vitaliv");
  assert.ok(!("brand" in dated), "brand must live inside the name");
});

test("normalizeOfferPresentation names are always Title Case, with units lowercase", () => {
  const condensed = normalizeOfferPresentation({
    name: "LEITE CONDENSADO MOÇA 340G SEMI DESN.",
    brand: "",
    detail: "340g",
    note: "",
  });
  assert.equal(condensed.name, "Leite Condensado Moça Semi Desn.");
  assert.equal(condensed.detail, "340g");
  assert.ok(!("brand" in condensed), "brand must live inside the name");

  const cleaner = normalizeOfferPresentation({
    name: "LAVA ROUPAS EM PÓ",
    brand: "",
    detail: "800g",
    note: "",
  });
  assert.equal(cleaner.name, "Lava Roupas em Pó");

  const beer = normalizeOfferPresentation({
    name: "CERVEJA LAGER HEINEKEN",
    brand: "",
    detail: "350ml",
    note: "",
  });
  assert.equal(beer.name, "Cerveja Lager Heineken");
  assert.ok(!("brand" in beer), "brand must live inside the name");

  const mixed = normalizeOfferPresentation({
    name: "BISTECA Suína",
    brand: "",
    detail: "kg",
    note: "",
  });
  assert.equal(mixed.name, "Bisteca Suína");
  assert.equal(mixed.detail, "kg");

  const kilo = normalizeOfferPresentation({
    name: "FILEZINHO SOLTINHO SEARA",
    brand: "",
    detail: "1 KG",
    note: "",
  });
  assert.equal(kilo.detail, "1kg", "kilogram details are always number+unit, like 1kg");

  const hyphen = normalizeOfferPresentation({
    name: "REFRIGERANTE COCA-COLA 2L",
    brand: "Coca-Cola",
    detail: "2L",
    note: "",
  });
  assert.equal(hyphen.name, "Refrigerante Coca-Cola");
  assert.equal(hyphen.detail, "2 Litros");
  assert.ok(!("brand" in hyphen), "brand must live inside the name");
});

test("normalizeOfferPresentation does not mistake produce varieties for brands", () => {
  const pineapple = normalizeOfferPresentation({
    name: "ABACAXI PÉROLA GRAÚDO",
    brand: "",
    detail: "UN.",
    note: "",
  });
  assert.equal(pineapple.name, "Abacaxi Pérola Graúdo");
  assert.ok(!("brand" in pineapple), "brand must live inside the name");

  const hazelnut = normalizeOfferPresentation({
    name: "CREME AVELÃ NUTELLA",
    brand: "",
    detail: "140G",
    note: "",
  });
  assert.equal(hazelnut.name, "Creme Avelã Nutella");
  assert.ok(!("brand" in hazelnut), "brand must live inside the name");
});

test("normalizeOfferPresentation moves flyer banners to a notice above the name", () => {
  const offer = normalizeOfferPresentation({
    name: "Ofertas especiais deste box válidas para sexta e sábado, 23 e 24/10/2026 Ofertas válidas de quinta a domingo, 22 a 25/10/2026 ou enquanto durarem nossos estoques. LEITE UHT LIDER GFA",
    brand: "",
    detail: "1L",
    note: "",
  });
  assert.equal(offer.name, "Leite Uht Lider Gfa");
  assert.ok(!("brand" in offer), "brand must live inside the name");
  assert.match(offer.notice, /^Ofertas especiais deste box/);
  assert.match(offer.notice, /estoques\.$/);
});

test("normalizeOfferPresentation strips promo prefixes, section headers and stray symbols", () => {
  const bread = normalizeOfferPresentation({
    name: "APARTIR DE UNIDADES PAGUE: 2 PÃO DE FORMA BAUDUCCO TRADICIONAL",
    brand: "",
    detail: "390G",
    note: "",
  });
  assert.equal(bread.name, "Pão de Forma Bauducco Tradicional");
  assert.ok(!("brand" in bread), "brand must live inside the name");

  const pasta = normalizeOfferPresentation({
    name: "LIMPEZA E PERFUMARIA BAZAR MATINAIS RESFRIADOS MACARRÃO C/ OVOS RENATA",
    brand: "",
    detail: "500G",
    note: "",
  });
  assert.equal(pasta.name, "Matinais Resfriados Macarrão c/ Ovos Renata");
  assert.ok(!("brand" in pasta), "brand must live inside the name");

  const headers = normalizeOfferPresentation({
    name: "BEBIDAS MERCEARIAS AÇOUGUE MOLHO DE TOMATE FUGINI SACHÊ",
    brand: "",
    detail: "300G",
    note: "",
  });
  assert.equal(headers.name, "Molho de Tomate Fugini Sachê");
  assert.ok(!("brand" in headers), "brand must live inside the name");

  const wine = normalizeOfferPresentation({
    name: "□ VINHO CHILENO CHILANO",
    brand: "",
    detail: "750ML",
    note: "Limite por cliente— —UN",
  });
  assert.equal(wine.name, "Vinho Chileno Chilano");
  assert.ok(!("brand" in wine), "brand must live inside the name");
  assert.equal(wine.note, "", "corrupted limit excerpts must be dropped");

  const phantom = normalizeOfferPresentation({
    name: "NESTA EMBALAGEM A UNIDADE SAI POR:",
    brand: "",
    detail: "Unidade",
    note: "",
  });
  assert.equal(phantom.name, "");
});

test("normalizeOfferPresentation turns LV/PG codes into bundle notices", () => {
  const paper = normalizeOfferPresentation({
    name: "PAPEL HIGIÊNICO FOLHA DUPLA 30M MIMMO",
    brand: "",
    detail: "LV12 PG11",
    note: "",
  });
  assert.equal(paper.name, "Papel Higiênico Folha Dupla 30m Mimmo");
  assert.equal(paper.detail, "Unidade");
  assert.equal(paper.note, "Leve 12 e pague 11");

  const sponge = normalizeOfferPresentation({
    name: "ESPONJA BRILHUS MULTIUSO",
    brand: "",
    detail: "LV4 PG3",
    note: "",
  });
  assert.equal(sponge.detail, "Unidade");
  assert.equal(sponge.note, "Leve 4 e pague 3");

  const amaciante = normalizeOfferPresentation({
    name: "AMACIANTE CONCENTRADO COMFORT LV500 PG",
    brand: "",
    detail: "400ML",
    note: "",
  });
  assert.equal(amaciante.name, "Amaciante Concentrado Comfort");
  assert.ok(!("brand" in amaciante), "brand must live inside the name");
  assert.equal(amaciante.detail, "400ml");

  const toalha = normalizeOfferPresentation({
    name: "TOALHA UMEDECIDA",
    brand: "",
    detail: "Leve 120un e Pague 100un",
    note: "",
  });
  assert.equal(toalha.detail, "Unidade");
  assert.equal(toalha.note, "Leve 120 e pague 100");

  const cereal = normalizeOfferPresentation({
    name: "CEREAL LEVE 620G, PAGUE 520G",
    brand: "",
    detail: "500G",
    note: "",
  });
  assert.equal(cereal.name, "Cereal");
  assert.equal(cereal.note, "Leve 620g e pague 520g");

  const personal = normalizeOfferPresentation({
    name: "Papel Higiênico PERSONAL Vip 20m Leve 12, Pague",
    brand: "",
    detail: "11 Unid.",
    note: "",
  });
  assert.equal(personal.name, "Papel Higiênico Personal Vip 20m");
  assert.equal(personal.detail, "11 unidades");
  assert.equal(personal.note, "Leve 12 e pague 11");

  const cupNoodles = normalizeOfferPresentation({
    name: "a Mais COMPRE 2 UNIDS. E GANHE GUARANÁ ANTÁRCTICA 2L 1 Macarrão Instantâneo CUP NOODLES",
    brand: "",
    detail: "65/72g",
    note: "",
  });
  assert.equal(cupNoodles.name, "Macarrão Instantâneo Cup Noodles");
  assert.ok(!("brand" in cupNoodles), "brand must live inside the name");
  assert.equal(cupNoodles.note, "COMPRE 2 UNIDS. E GANHE GUARANÁ ANTÁRCTICA 2L");

  const toddynho = normalizeOfferPresentation({
    name: "a Mais COMPRE 2 UNIDS. E GANHE SUKITA DE 2L1 Bebida Láctea TODDYNHO",
    brand: "",
    detail: "200g",
    note: "",
  });
  assert.equal(toddynho.name, "Bebida Láctea Toddynho");
  assert.equal(toddynho.note, "COMPRE 2 UNIDS. E GANHE SUKITA DE 2L");
});

test("normalizeOfferPresentation keeps brand words in flyer names instead of extracting them", () => {
  const cases = [
    ["ENERGÉTICO MONSTER ENERGY", "Energético Monster Energy", "Monster"],
    ["ÁGUA MINERAL BIOLEVE C/ GÁS", "Água Mineral Bioleve c/ Gás", "Bioleve"],
    ["PÃO DE FORMA WICKBOLD INTEGRAL", "Pão de Forma Wickbold Integral", "Wickbold"],
    ["SABONETE DOVE", "Sabonete Dove", "Dove"],
    ["DESODORANTE AERO NIVEA", "Desodorante Aero Nivea", "Nivea"],
    ["CREME DE LEITE PIRACANJUBA", "Creme de Leite Piracanjuba", "Piracanjuba"],
    ["ARROZ TIPO 1 SERRAZUL", "Arroz Tipo 1 Serrazul", "Serrazul"],
    ["SANDÁLIA HAVAIANAS TOP CN", "Sandália Havaianas Top Cn", "Havaianas"],
    ["ACHOCOLATADO EM PÓ TODDY", "Achocolatado em Pó Toddy", "Toddy"],
    ["MACARRÃO INSTANTÂNEO NISSIN", "Macarrão Instantâneo Nissin", "Nissin"],
    ["LEITE EM PÓ NINHO 380G +10% GRÁTIS", "Leite em Pó Ninho +10% Grátis", "Ninho"],
    ["APARTIR DE UNIDADES PAGUE: 3 FILTRO DE PAPEL 3 CORAÇÕES 103 30UN", "Filtro de Papel 3 Corações 103 30un", "Corações"],
  ];
  for (const [name, expectedName, brandWord] of cases) {
    const offer = normalizeOfferPresentation({ name, brand: "", detail: "Unidade", note: "" });
    assert.equal(offer.name, expectedName, `name for ${name}`);
    assert.ok(!("brand" in offer), "brand must live inside the name");
    assert.match(offer.name, new RegExp(brandWord, "i"), `brand word kept for ${name}`);
  }
});

test("normalizeOfferPresentation moves a single quantity from the name into detail", () => {
  const lacta = normalizeOfferPresentation({ name: "Choc. Lacta 80g", brand: "", detail: "", note: "" });
  assert.equal(lacta.name, "Choc. Lacta");
  assert.equal(lacta.detail, "80g");

  const juice = normalizeOfferPresentation({ name: "SUCO INTEGRAL AURORA TP 1,5L UVA", brand: "Aurora", detail: "Unidade", note: "" });
  assert.equal(juice.name, "Suco Integral Aurora Tp Uva");
  assert.equal(juice.detail, "1,5 Litros");

  const realDetail = normalizeOfferPresentation({ name: "Choc. Lacta 80g", brand: "", detail: "104G", note: "" });
  assert.equal(realDetail.name, "Choc. Lacta");
  assert.equal(realDetail.detail, "104g", "a real detail wins over the name quantity");

  const connector = normalizeOfferPresentation({ name: "Cerveja Skol Pilsen c/ 350ml", brand: "", detail: "Unid.", note: "" });
  assert.equal(connector.name, "Cerveja Skol Pilsen");
  assert.equal(connector.detail, "350ml");

  const kit = normalizeOfferPresentation({ name: "Kit Seda Shampoo 300ml + Condicionador 190ml", brand: "", detail: "Unid.", note: "" });
  assert.equal(kit.name, "Kit Seda Shampoo 300ml + Condicionador 190ml", "multi-quantity names stay untouched");
  assert.equal(kit.detail, "Unidade");

  const count = normalizeOfferPresentation({ name: "Pilha Duracell Alc. Palito AAA 2un", brand: "", detail: "", note: "" });
  assert.equal(count.name, "Pilha Duracell Alc. Palito Aaa 2un");
  assert.equal(count.detail, "Unidade");
});

test("normalizeOfferNote fixes limits and promotional copy", () => {
  assert.equal(normalizeOfferNote("Limite por cliente5 KG"), "Limite de 5 kg por cliente");
  assert.equal(normalizeOfferNote("Limite por\ncliente 24UN"), "Limite de 24 unidades por cliente");
  assert.equal(normalizeOfferNote("Limite por\ncliente 1 un"), "Limite de 1 unidade por cliente");
  assert.equal(
    normalizeOfferNote("NESTA OFERTA A UNID. SAI POR R$ 4,49 · PAGUE 3 LEVE 4"),
    "Nesta oferta, a unidade sai por R$ 4,49 · pague 3 leve 4",
  );
  assert.equal(
    normalizeOfferNote("NESTA OFERTA A UNID. SAI POR R$ 1,25 · POR R$ 10,00 · LEVE 8"),
    "Nesta oferta, a unidade sai por R$ 1,25 · por R$ 10,00 · leve 8",
  );
  assert.equal(
    normalizeOfferNote("Preço Club Plus · oferta do açougue válida de 14 a 16/10"),
    "Preço Club Plus · Oferta do açougue válida de 14 a 16/10",
  );
  assert.equal(normalizeOfferNote("Limite por cliente— —UN"), "", "corrupted limit without quantity is dropped");
  assert.equal(normalizeOfferNote("Limite por cliente de 24un"), "Limite de 24 unidades por cliente");
  assert.equal(
    normalizeOfferNote("Limite por cliente6 UN · Pague 3 Leve 4"),
    "Limite de 6 unidades por cliente · Pague 3 Leve 4",
  );
});

test("validateOffer and validateSnapshot reject invalid data and accept valid data", () => {
  const valid = {
    id: "test-item-1",
    store: "Loja Teste",
    storeLogo: "https://example.com/logo.png",
    branch: "Centro",
    name: "Arroz Tipo 1 Marca",
    detail: "5kg",
    category: "Mercearia",
    department: "Mercearia",
    productType: "Arroz",
    productTypes: ["Arroz"],
    price: 19.90,
    previousPrice: 24.90,
    icon: "🍚",
    tone: "#edf4e9",
    note: "",
    validFrom: "2026-10-19",
    validTo: "2026-10-22",
    source: "Folheto oficial",
    sourceUrl: "https://example.com/folheto.pdf",
  };

  assert.ok(validateOffer(valid));

  // Invalid price
  assert.ok(!validateOffer({ ...valid, price: -5 }));
  // Reversed previousPrice
  assert.ok(!validateOffer({ ...valid, previousPrice: 10 }));
  // Reversed dates
  assert.ok(!validateOffer({ ...valid, validFrom: "2026-10-25", validTo: "2026-10-20" }));
  // Missing productTypes
  assert.ok(!validateOffer({ ...valid, productTypes: [] }));

  assert.ok(validateSnapshot({
    storeId: "test",
    store: { name: "Loja Teste" },
    offers: [valid],
  }));

  assert.ok(!validateSnapshot({
    storeId: "test",
    store: { name: "Loja Teste" },
    offers: [],
  }));
});
