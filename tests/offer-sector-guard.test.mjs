import assert from "node:assert/strict";
import test from "node:test";
import { sectorViolations, expectedSectors } from "../scripts/offer-sector-guard.mjs";
import { resolveCategory } from "../src/catalog-taxonomy.mjs";

test("expectedSectors ignores limpeza when name is papel toalha multiuso", () => {
  const text = "papel toalha multiuso absoluto";
  assert.deepEqual(expectedSectors(text), [{ label: "casa", sector: "casa" }]);
});

test("sectorViolations accepts papel toalha multiuso in casa", () => {
  const text = "papel toalha multiuso absoluto";
  assert.deepEqual(sectorViolations("Papel Toalha Multiuso Absoluto", "casa", text), []);
});

test("resolveCategory classifies papel toalha multiuso as casa", () => {
  assert.deepEqual(resolveCategory({ name: "Papel Toalha Multiuso Absoluto", productTypes: ["Limpeza"] }), {
    groupId: "casa",
    subcategory: "Papel higiênico e papel-toalha",
  });
});

test("limpeza multiuso without paper stays limpeza", () => {
  const text = "limpador multiuso ype";
  assert.ok(expectedSectors(text).some(({ sector }) => sector === "limpeza"));
  assert.deepEqual(sectorViolations("Limpador Multiuso", "limpeza", text), []);
});
