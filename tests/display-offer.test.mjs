import assert from "node:assert/strict";
import test from "node:test";
import { displayOfferIcon, formatOfferSpec } from "../scripts/domain/display-offer.mjs";
import { offerCardCategoryLine } from "../scripts/domain/card-category-line.mjs";

test("formatOfferSpec labels kg counter pricing", () => {
  assert.equal(formatOfferSpec("kg"), "por kg");
  assert.equal(formatOfferSpec("1kg"), "1kg");
});

test("displayOfferIcon fixes spice icon on marinated pork", () => {
  assert.equal(displayOfferIcon({
    name: "Picanha Suína Temperada",
    icon: "🧂",
    productType: "Carnes suínas",
    department: "Açougue e peixaria",
  }), "🐖");
});

test("offerCardCategoryLine shows açougue for kg counter cuts", () => {
  const line = offerCardCategoryLine(
    { store: "Big Bom", productType: "Carne bovina", productTypes: ["Carne bovina"], detail: "kg" },
    { groupId: "churrasco", subcategory: "Carnes para churrasco" },
    { activeDepartment: "" },
  );
  assert.equal(line, "Açougue · kg · Big Bom");
});
