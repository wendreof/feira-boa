import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeBrandIntoName } from "../src/shared/offer-name.mjs";

test("keeps the name when it already carries the brand", () => {
  assert.equal(mergeBrandIntoName("Maionese Hellmann's 500g", "Hellmann's"), "Maionese Hellmann's 500g");
  assert.equal(mergeBrandIntoName("Creme Avelã Nutella", "Nutella"), "Creme Avelã Nutella");
  assert.equal(mergeBrandIntoName("Sabão em Pó Omo Expert", "OMO"), "Sabão em Pó Omo Expert");
});

test("appends the brand when the name does not contain it", () => {
  assert.equal(mergeBrandIntoName("Lasanha", "Seara"), "Lasanha Seara");
  assert.equal(mergeBrandIntoName("Pão de Forma Tradicional", "Bauducco"), "Pão de Forma Tradicional Bauducco");
});

test("matches whole words only", () => {
  assert.equal(mergeBrandIntoName("Biscoito Cookies", "Cook"), "Biscoito Cookies Cook");
});

test("ignores an empty brand", () => {
  assert.equal(mergeBrandIntoName("Abacaxi", ""), "Abacaxi");
  assert.equal(mergeBrandIntoName("Abacaxi", undefined), "Abacaxi");
});
