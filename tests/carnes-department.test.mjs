import assert from "node:assert/strict";
import test from "node:test";
import {
  counterCutDetailHints,
  isPetFoodOfferName,
  isSoldByKilogram,
  matchesCarnesDepartment,
} from "../scripts/domain/carnes-department.mjs";

test("isSoldByKilogram accepts kg and Nkg details", () => {
  assert.equal(isSoldByKilogram("kg"), true);
  assert.equal(isSoldByKilogram("1kg"), true);
  assert.equal(isSoldByKilogram("1 KG"), true);
  assert.equal(isSoldByKilogram("2,5kg"), true);
  assert.equal(isSoldByKilogram("125g"), false);
  assert.equal(isSoldByKilogram("Cada 100g"), false);
  assert.equal(isSoldByKilogram("Unidade"), false);
});

test("matchesCarnesDepartment requires counter meat and fish sold by kg", () => {
  assert.equal(matchesCarnesDepartment({
    productType: "Carne bovina",
    productTypes: ["Carne bovina"],
    detail: "kg",
  }), true);
  assert.equal(matchesCarnesDepartment({
    productType: "Carnes suínas",
    productTypes: ["Carnes suínas"],
    detail: "1kg",
  }), true);
  assert.equal(matchesCarnesDepartment({
    productType: "Peixes",
    productTypes: ["Peixes"],
    detail: "kg",
  }), true);
  assert.equal(matchesCarnesDepartment({
    productType: "Peixes",
    productTypes: ["Peixes"],
    detail: "125g",
  }), false);
  assert.equal(matchesCarnesDepartment({
    productType: "Carne bovina",
    productTypes: ["Carne bovina"],
    detail: "100g",
  }), false);
  assert.equal(matchesCarnesDepartment({
    productType: "Frango",
    productTypes: ["Frango"],
    detail: "kg",
  }), true);
  assert.equal(matchesCarnesDepartment({
    productType: "Frango",
    productTypes: ["Frango"],
    detail: "800g",
  }), false);
  assert.equal(matchesCarnesDepartment({
    productType: "Presunto",
    productTypes: ["Frios e embutidos"],
    detail: "100g",
  }), false);
});

test("isPetFoodOfferName flags ration products", () => {
  assert.equal(isPetFoodOfferName("Ração Gatos Peixe Adultos Yuppie 1kg"), true);
  assert.equal(isPetFoodOfferName("Filé de Tilápia"), false);
});

test("counterCutDetailHints reports non-kg counter types", () => {
  const hints = counterCutDetailHints({
    id: "sample",
    name: "Filé de Tilápia",
    productType: "Peixes",
    detail: "800g",
  });
  assert.equal(hints.length, 1);
  assert.match(hints[0], /fora do filtro Açougue/);
});

test("matchesCarnesDepartment rejects kg pet food misclassified as fish", () => {
  assert.equal(matchesCarnesDepartment({
    name: "Ração Gatos Peixe Adultos Yuppie 1kg",
    productType: "Peixes",
    productTypes: ["Peixes"],
    detail: "1kg",
  }), false);
});
