import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldShowBrand } from "../src/offer-display.mjs";

test("hides the brand when the name already contains it", () => {
  assert.equal(shouldShowBrand("Maionese Hellmann's 500g", "Hellmann's"), false);
  assert.equal(shouldShowBrand("Creme Avelã Nutella", "Nutella"), false);
  assert.equal(shouldShowBrand("Sabão em Pó Omo Expert", "OMO"), false);
});

test("shows the brand when the name does not contain it", () => {
  assert.equal(shouldShowBrand("Lasanha", "Seara"), true);
  assert.equal(shouldShowBrand("Pão de Forma Tradicional", "Bauducco"), true);
});

test("matches whole words only", () => {
  assert.equal(shouldShowBrand("Biscoito Cookies", "Cook"), true);
});

test("hides nothing when there is no brand", () => {
  assert.equal(shouldShowBrand("Abacaxi", ""), false);
  assert.equal(shouldShowBrand("Abacaxi", undefined), false);
});
