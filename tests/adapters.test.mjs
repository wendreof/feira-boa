import assert from "node:assert/strict";
import test from "node:test";
import { assignIcon, classifyProduct, fetchWithRetry, parseDateRange, parsePrice, slug, validateOffer, validateSnapshot } from "../scripts/adapters/common.mjs";

test("parseDateRange handles various Brazilian flyer date formats", () => {
  const d1 = parseDateRange("Ofertas válidas de 19/10 até 21/10/2026");
  assert.deepEqual(d1, { from: "2026-10-19", to: "2026-10-21" });

  const d2 = parseDateRange("OFERTAS VÁLIDAS DE 19 A 22 DE OUTUBRO DE 2026");
  assert.deepEqual(d2, { from: "2026-10-19", to: "2026-10-22" });

  const d3 = parseDateRange("DE 19 A 21/10/2026");
  assert.deepEqual(d3, { from: "2026-10-19", to: "2026-10-21" });

  const d4 = parseDateRange("19 a 21 de out.", 2026);
  assert.deepEqual(d4, { from: "2026-10-19", to: "2026-10-21" });

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
  const beef = classifyProduct("Costela Bovina", "Friboi", "Carnes");
  assert.equal(beef.department, "Açougue e peixaria");
  assert.equal(beef.productType, "Carne bovina");
  assert.ok(beef.productTypes.includes("Churrasco"));

  const milk = classifyProduct("Leite Longa Vida Líder 1L", "Líder", "Laticínios");
  assert.equal(milk.department, "Frios e laticínios");
  assert.equal(milk.productType, "Leites");

  const detergent = classifyProduct("Lava Roupas OMO", "OMO", "Limpeza");
  assert.equal(detergent.department, "Casa e limpeza");
  assert.equal(detergent.productType, "Lavanderia e limpeza");

  const eggs = classifyProduct("Ovos Vermelhos São Caipira 10un", "", "Geral");
  assert.equal(eggs.department, "Mercearia");
  assert.equal(eggs.productType, "Ovos");

  const sandals = classifyProduct("Sandália Ipanema Clássica", "", "Geral");
  assert.equal(sandals.department, "Vestuário e calçados");
  assert.equal(sandals.productType, "Calçados");

  const kettle = classifyProduct("Feirinha New Fort Flon", "", "Geral");
  assert.equal(kettle.department, "Casa e limpeza");
  assert.equal(kettle.productType, "Casa");

  const hazelnut = classifyProduct("Creme Avelã Nutella 140g", "", "Geral");
  assert.equal(hazelnut.department, "Mercearia");
  assert.equal(hazelnut.productType, "Doces e snacks");

  const unknown = classifyProduct("Produto sem categoria", "", "Geral");
  assert.equal(unknown.department, "Outros");
  assert.equal(unknown.productType, "Outros");
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

test("validateOffer and validateSnapshot reject invalid data and accept valid data", () => {
  const valid = {
    id: "test-item-1",
    store: "Loja Teste",
    storeLogo: "https://example.com/logo.png",
    branch: "Centro",
    name: "Arroz Tipo 1",
    brand: "Marca",
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
