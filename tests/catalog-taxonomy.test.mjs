import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_SECTORS_LABEL,
  TAXONOMY_GROUPS,
  categoryOrder,
  discountRatio,
  resolveCategory,
} from "../catalog-taxonomy.mjs";

test("taxonomy keeps the requested sector order", () => {
  const labels = TAXONOMY_GROUPS.map((group) => group.label);
  assert.equal(labels[0], "Alimentos frescos");
  assert.equal(labels[1], "Mercearia");
  assert.equal(labels[2], "Bebidas");
  assert.equal(labels[3], "Bebidas alcoólicas");
  assert.equal(labels[4], "Congelados e refeições");
  assert.equal(labels[5], "Saudáveis e dietéticos");
  assert.equal(labels[6], "Limpeza");
  assert.equal(labels[7], "Higiene e beleza");
  assert.equal(labels[8], "Bebês e infantil");
  assert.equal(labels[9], "Pet shop");
  assert.equal(labels[10], "Casa e utilidades");
  assert.equal(labels[11], "Churrasco e festas");
  assert.ok(labels.includes("Vestuário e calçados"));
  assert.ok(labels.includes("Outros"));
  assert.equal(ALL_SECTORS_LABEL, "Todos os setores");
});

test("resolveCategory maps product types to the new groups", () => {
  assert.deepEqual(resolveCategory({ name: "Banana Prata", productTypes: ["Hortifruti"] }), { groupId: "frescos", subcategory: "Hortifruti" });
  assert.deepEqual(resolveCategory({ name: "Costela Bovina", productTypes: ["Carne bovina"] }), { groupId: "frescos", subcategory: "Açougue e carnes frescas" });
  assert.deepEqual(resolveCategory({ name: "Peito de Frango", productTypes: ["Frango"] }), { groupId: "frescos", subcategory: "Aves" });
  assert.deepEqual(resolveCategory({ name: "Filé de Tilápia", productTypes: ["Peixes"] }), { groupId: "frescos", subcategory: "Peixaria e frutos do mar" });
  assert.deepEqual(resolveCategory({ name: "Arroz Tipo 1", productTypes: ["Arroz"] }), { groupId: "mercearia", subcategory: "Mercearia básica" });
  assert.deepEqual(resolveCategory({ name: "Arroz Integral", productTypes: ["Arroz"] }), { groupId: "saudaveis", subcategory: "Produtos integrais" });
  assert.deepEqual(resolveCategory({ name: "Cerveja Pilsen", productTypes: ["Cervejas"] }), { groupId: "bebidas_alcoolicas", subcategory: "Cervejas" });
  assert.deepEqual(resolveCategory({ name: "Salsicha Sadia", productTypes: ["Frios"] }), { groupId: "frescos", subcategory: "Frios e embutidos" });
  assert.deepEqual(resolveCategory({ name: "Papel Higiênico Folha Dupla", productTypes: ["Papel higiênico"] }), { groupId: "casa", subcategory: "Papel higiênico e papel-toalha" });
  assert.deepEqual(resolveCategory({ name: "Sandália Ipanema", productTypes: ["Calçados"] }), { groupId: "vestuario", subcategory: "Calçados" });
});

test("resolveCategory keeps embutidos out of the meat categories", () => {
  const sausage = resolveCategory({ name: "Linguiça Calabresa Sadia", productTypes: ["Frios"] });
  assert.equal(sausage.groupId, "frescos");
  assert.equal(sausage.subcategory, "Frios e embutidos");

  const pork = resolveCategory({ name: "Filé Mignon Suíno em Bifes", productTypes: ["Carnes suínas"] });
  assert.equal(pork.groupId, "frescos");
  assert.equal(pork.subcategory, "Açougue e carnes frescas");
});

test("resolveCategory uses keywords for groups without a product type", () => {
  assert.deepEqual(resolveCategory({ name: "Fralda P/M 30un", productTypes: ["Higiene pessoal"] }), { groupId: "infantil", subcategory: "Fraldas" });
  assert.deepEqual(resolveCategory({ name: "Ração Adulto Cães 15kg", productTypes: ["Pet"] }), { groupId: "pet", subcategory: "Ração para cães" });
  assert.deepEqual(resolveCategory({ name: "Pão de Mel", productTypes: ["Mercearia"] }), { groupId: "frescos", subcategory: "Padaria e confeitaria" });
  assert.deepEqual(resolveCategory({ name: "Pizza Calabresa", productTypes: ["Congelados"] }), { groupId: "congelados", subcategory: "Salgados e pizzas" });
});

test("resolveCategory sends barbecue products to the churrasco group", () => {
  const picanha = resolveCategory({ name: "Picanha Friboi", productTypes: ["Carne bovina", "Churrasco"] });
  assert.equal(picanha.groupId, "churrasco");
  assert.equal(picanha.subcategory, "Carnes para churrasco");

  const charcoal = resolveCategory({ name: "Carvão para Churrasco", productTypes: ["Casa", "Churrasco"] });
  assert.equal(charcoal.groupId, "churrasco");
  assert.equal(charcoal.subcategory, "Carvão e acendedores");

  const snack = resolveCategory({ name: "Salgadinho de Batata Picanha Brasileira", productTypes: ["Doces e snacks", "Churrasco"] });
  assert.notEqual(snack.groupId, "churrasco");
});

test("categoryOrder follows the sector order", () => {
  const frescos = categoryOrder(resolveCategory({ name: "Banana", productTypes: ["Hortifruti"] }));
  const mercearia = categoryOrder(resolveCategory({ name: "Arroz", productTypes: ["Arroz"] }));
  const bebidas = categoryOrder(resolveCategory({ name: "Cerveja", productTypes: ["Cervejas"] }));
  assert.ok(frescos[0] < mercearia[0]);
  assert.ok(mercearia[0] < bebidas[0]);
});

test("discountRatio returns the percentage saved on each offer", () => {
  assert.equal(discountRatio({ price: 8, previousPrice: 10 }), 0.2);
  assert.equal(discountRatio({ price: 10, previousPrice: null }), 0);
  assert.equal(discountRatio({ price: 10, previousPrice: 10 }), 0);
});
