import assert from "node:assert/strict";
import test from "node:test";
import { buildDepartmentOfferCounts } from "../scripts/domain/department-offer-counts.mjs";

test("buildDepartmentOfferCounts respects carnes kg rule", () => {
  const counts = buildDepartmentOfferCounts(
    [
      { id: "a", productType: "Carne bovina", productTypes: ["Carne bovina"], detail: "kg" },
      { id: "b", productType: "Carne bovina", productTypes: ["Carne bovina"], detail: "100g" },
      { id: "c", productType: "Frios", productTypes: ["Frios"], detail: "100g" },
    ],
    (offer) => (offer.id === "c"
      ? { groupId: "frescos", subcategory: "Frios e embutidos" }
      : { groupId: "frescos", subcategory: "Açougue e carnes frescas" }),
  );
  assert.equal(counts.get("carnes"), 1);
  assert.equal(counts.get("frios_embutidos"), 1);
});
