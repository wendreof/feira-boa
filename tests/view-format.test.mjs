import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateLabel,
  formatFeedUpdate,
  isActive,
  money,
  normalizeSearch,
  addCalendarDays,
  expiryHighlightLabel,
} from "../src/view/format.ts";

test("money and dateLabel use Brazilian formatting", () => {
  assert.match(money(4.18), /^R\$\s*4,18$/);
  assert.match(dateLabel("2026-10-22"), /^22\s+\w{3}$/i);
});

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

test("offer with weekday spot is active only on listed days within encarte window", () => {
  const offer = { validFrom: "2026-11-16", validTo: "2026-11-21", validWeekdays: [2, 3] };
  assert.equal(isActive(offer, "2026-11-17"), true);
  assert.equal(isActive(offer, "2026-11-19"), false);
});

test("expiry highlight flags today and tomorrow before the offer ends", () => {
  const offer = { validFrom: "2026-10-20", validTo: "2026-10-25" };
  assert.equal(addCalendarDays("2026-10-24", 1), "2026-10-25");
  assert.equal(expiryHighlightLabel(offer, "2026-10-25"), "Último dia");
  assert.equal(expiryHighlightLabel(offer, "2026-10-24"), "Expira amanhã");
  assert.equal(expiryHighlightLabel(offer, "2026-10-23"), null);
  assert.equal(expiryHighlightLabel(offer, "2026-10-26"), null);
});
