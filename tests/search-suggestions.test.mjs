import assert from "node:assert/strict";
import test from "node:test";
import { suggestSearches } from "../scripts/domain/search-suggestions.mjs";

const offers = [
  { name: "Refrigerante Coca-Cola Zero", detail: "2 Litros", store: "Pague Menos" },
  { name: "Refrigerante Coca-Cola Zero", detail: "2 Litros", store: "Big Bom" },
  { name: "Café Pilão Tradicional", detail: "500g", store: "Corso" },
  { name: "Achocolatado Toddy", detail: "400g", store: "Forte Mix" },
];

test("suggestSearches lists stores when the query is empty", () => {
  const suggestions = suggestSearches(offers, "");
  assert.ok(suggestions.some((item) => item.kind === "store" && item.label === "Pague Menos"));
  assert.ok(suggestions.some((item) => item.label === "Refrigerante Coca-Cola Zero"));
});

test("suggestSearches groups matching products and stores", () => {
  const suggestions = suggestSearches(offers, "coca");
  assert.equal(suggestions[0].label, "Refrigerante Coca-Cola Zero");
  assert.equal(suggestions[0].kind, "product");
  assert.equal(suggestions[0].count, 2);
  assert.ok(!suggestions.some((item) => item.label === "Café Pilão Tradicional"));
});

test("suggestSearches includes a store when its name matches", () => {
  const suggestions = suggestSearches(offers, "pague");
  assert.equal(suggestions[0].kind, "store");
  assert.equal(suggestions[0].label, "Pague Menos");
});
