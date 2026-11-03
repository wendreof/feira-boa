import assert from "node:assert/strict";
import test from "node:test";
import { isSoldByKilogram, matchesCarnesDepartment } from "../scripts/domain/carnes-department.mjs";

test("isSoldByKilogram accepts kg and Nkg details", () => {
  assert.equal(isSoldByKilogram("kg"), true);
  assert.equal(isSoldByKilogram("1kg"), true);
  assert.equal(isSoldByKilogram("1 KG"), true);
  assert.equal(isSoldByKilogram("2,5kg"), true);
  assert.equal(isSoldByKilogram("125g"), false);
  assert.equal(isSoldByKilogram("Cada 100g"), false);
  assert.equal(isSoldByKilogram("Unidade"), false);
});

test("matchesCarnesDepartment requires beef, pork, or fish sold by kg", () => {
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
  }), false);
  assert.equal(matchesCarnesDepartment({
    productType: "Presunto",
    productTypes: ["Frios e embutidos"],
    detail: "100g",
  }), false);
});
