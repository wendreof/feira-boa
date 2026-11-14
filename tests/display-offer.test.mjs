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

test("offerCardCategoryLine labels kg chicken as açougue, not churrasco", () => {
  const line = offerCardCategoryLine(
    { store: "Big Bom", productType: "Frango", productTypes: ["Frango"], detail: "kg" },
    { groupId: "frescos", subcategory: "Aves" },
    { activeDepartment: "" },
  );
  assert.equal(line, "Açougue · kg · Big Bom");
});

test("offerCardCategoryLine keeps kg pet food out of açougue", () => {
  const line = offerCardCategoryLine(
    { store: "Corso", productType: "Pet", productTypes: ["Pet"], detail: "1kg" },
    { groupId: "pet", subcategory: "Ração para gatos" },
    { activeDepartment: "carnes" },
  );
  assert.equal(line, "Ração para gatos · Corso");
});

test("offerCardCategoryLine keeps misclassified peixe pet ration out of açougue", () => {
  const line = offerCardCategoryLine(
    {
      store: "Corso",
      name: "Ração Gatos Peixe Adultos Yuppie 1kg",
      productType: "Peixes",
      productTypes: ["Peixes"],
      detail: "1kg",
    },
    { groupId: "frescos", subcategory: "Açougue e carnes frescas" },
    { activeDepartment: "carnes" },
  );
  assert.equal(line, "Açougue e carnes frescas · Corso");
});
