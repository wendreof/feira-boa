import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOfferSearchDocument,
  matchesOfferSearch,
  normalizeSearchText,
  parseSearchTerms,
} from "../scripts/domain/offer-search.mjs";

const sampleOffer = {
  name: "Refrigerante Coca-Cola Zero 2 Litros",
  detail: "2 Litros",
  category: "Bebidas",
  department: "Bebidas",
  productTypes: ["Refrigerantes"],
  store: "Pague Menos",
  branch: "Centro",
  note: "",
  notice: "",
};

const sampleDoc = buildOfferSearchDocument(sampleOffer, {
  subcategory: "Refrigerantes",
  groupLabel: "Bebidas",
});

test("normalizeSearchText folds accents and punctuation", () => {
  assert.equal(normalizeSearchText("  Iogurte, Líquido! "), "iogurte liquido");
  assert.equal(normalizeSearchText("CAFÉ-500g"), "cafe 500g");
  assert.equal(normalizeSearchText("1,5 Litros"), "1.5 litros");
  assert.equal(normalizeSearchText("Coxa c/ Sobrecoxa"), "coxa com sobrecoxa");
});

test("matchesOfferSearch handles c/ abbreviation in meat product names", () => {
  const doc = buildOfferSearchDocument(
    {
      name: "Coxa c/ Sobrecoxa de Frango Avelícia Pacote",
      detail: "1 kg",
      category: "Carnes",
      department: "Carnes",
      productTypes: ["Frango"],
      store: "Sempre Vale",
      branch: "",
      note: "",
      notice: "",
    },
    { subcategory: "Aves", groupLabel: "Frescos" },
  );
  assert.ok(matchesOfferSearch("Coxa c/ Sobrecoxa de Frango", doc));
  assert.ok(matchesOfferSearch("sobrecoxa frango", doc));
});

test("parseSearchTerms drops stop words but keeps product words", () => {
  assert.deepEqual(parseSearchTerms("leite em po"), ["leite", "po"]);
  assert.deepEqual(parseSearchTerms("de da do"), []);
  assert.deepEqual(parseSearchTerms(""), []);
});

test("matchesOfferSearch accepts aliases and prefix matches", () => {
  assert.ok(matchesOfferSearch("refri coca", sampleDoc));
  assert.ok(matchesOfferSearch("refrigerante zero", sampleDoc));
  assert.ok(matchesOfferSearch("iog", buildOfferSearchDocument({
    ...sampleOffer,
    name: "Iogurte Nestlé Morango 170g",
    productTypes: ["Iogurtes"],
  })));
});

test("matchesOfferSearch ignores word order and extra stop words", () => {
  assert.ok(matchesOfferSearch("zero coca cola de 2 litros", sampleDoc));
  assert.ok(!matchesOfferSearch("cerveja skol", sampleDoc));
});

test("matchesOfferSearch tolerates a single-character typo on long words", () => {
  const doc = buildOfferSearchDocument({
    ...sampleOffer,
    name: "Achocolatado em Pó Toddy 400g",
    productTypes: ["Achocolatados"],
  });
  assert.ok(matchesOfferSearch("achocolatado toddy", doc));
  assert.ok(matchesOfferSearch("achocolatdo toddy", doc));
});

test("matchesOfferSearch matches compact store names", () => {
  const doc = buildOfferSearchDocument({
    ...sampleOffer,
    store: "Pague Menos",
  });
  assert.ok(matchesOfferSearch("paguemenos refri", doc));
});

test("matchesOfferSearch matches plural and singular", () => {
  const doc = buildOfferSearchDocument({
    ...sampleOffer,
    name: "Fralda Pampers Confort Sec G",
    productTypes: ["Fraldas"],
  });
  assert.ok(matchesOfferSearch("fralda pampers", doc));
  assert.ok(matchesOfferSearch("fraldas pampers", doc));
});
