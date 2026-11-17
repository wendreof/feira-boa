import assert from "node:assert/strict";
import test from "node:test";
import { auditOfferIcon, summarizeIconAudit } from "../scripts/domain/icon-audit.mjs";
import { assignIcon } from "../scripts/domain/icons.mjs";

test("auditOfferIcon flags stale feed when icon lags assignIcon rules", () => {
  const row = auditOfferIcon({
    id: "x",
    name: "Lava-Louças Líquido Ypê",
    productType: "Outros",
    department: "Casa e limpeza",
    icon: "🏷️",
  });
  assert.equal(row.assigned, "🧺");
  assert.ok(row.issues.some((issue) => issue.kind === "stale_feed"));
  assert.ok(row.issues.some((issue) => issue.autoFixable));
});

test("assignIcon covers newly added household keywords", () => {
  assert.equal(assignIcon("Neutralizador de Odores Spray Bom Ar", "Lavanderia e limpeza"), "🧺");
  assert.equal(assignIcon("Gel Dental Closeup Liquifresh", "Higiene pessoal"), "🪥");
  assert.equal(assignIcon("Toalhas Umedecidas Johnson's Baby", "Higiene pessoal"), "🧻");
  assert.equal(assignIcon("Panetone Artesanal Sempre Vale", "Outros"), "🎂");
  assert.equal(assignIcon("Carvão Jacaré", "Casa"), "♨️");
  assert.equal(assignIcon("Alimento Pedigree Sachê", "Outros"), "🦴");
});

test("summarizeIconAudit aggregates issue counts", () => {
  const audit = summarizeIconAudit([
    { name: "Produto Sem Regra", productType: "Outros", icon: "🏷️" },
    { name: "Café Solúvel", productType: "Café", icon: "☕" },
  ]);
  assert.equal(audit.summary.totalOffers, 2);
  assert.ok(audit.summary.flaggedOffers >= 1);
  assert.ok(audit.summary.issuesByKind.generic_icon >= 1);
});