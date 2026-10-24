import { test } from "node:test";
import assert from "node:assert/strict";
import { formatFeedUpdate, isActive, normalizeSearch } from "../src/view/format.ts";

test("feed update line falls back when the timestamp is invalid", () => {
  assert.equal(formatFeedUpdate("not a date"), "Atualização das ofertas indisponível");
  assert.match(formatFeedUpdate("2026-10-24T12:30:00Z"), /^Catálogo atualizado em \d{2} de \w+ de 2026, \d{2}:\d{2}$/);
});

test("search text drops accents, case and punctuation", () => {
  assert.equal(normalizeSearch("  Iogurte, Líquido! "), "iogurte líquido".normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  assert.equal(normalizeSearch("CAFÉ-500g"), "cafe 500g");
});

test("offer is active on both validity boundaries and not outside them", () => {
  const offer = { validFrom: "2026-10-22", validTo: "2026-10-25" };
  assert.equal(isActive(offer, "2026-10-22"), true);
  assert.equal(isActive(offer, "2026-10-25"), true);
  assert.equal(isActive(offer, "2026-10-21"), false);
  assert.equal(isActive(offer, "2026-10-26"), false);
});
