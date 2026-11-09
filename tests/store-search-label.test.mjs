import assert from "node:assert/strict";
import test from "node:test";
import { storeNameFromSearch } from "../scripts/domain/store-search-label.mjs";

const stores = ["Todas as lojas", "Forte Mix", "Spani Atacadista"];

test("storeNameFromSearch matches store labels in the search box", () => {
  assert.equal(storeNameFromSearch(stores, "forte mix"), "Forte Mix");
  assert.equal(storeNameFromSearch(stores, "spani"), "Spani Atacadista");
  assert.equal(storeNameFromSearch(stores, "arroz"), null);
});
