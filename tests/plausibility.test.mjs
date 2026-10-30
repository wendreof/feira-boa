import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPlausibility } from "../scripts/feed/plausibility.mjs";

const NOW = new Date("2026-10-30T12:00:00Z");

function offer(i, overrides = {}) {
  return {
    id: `offer-${i}`,
    store: "Big Bom",
    branch: "Vila Zanetti",
    name: `Produto ${i}`,
    price: 10 + i,
    previousPrice: null,
    validFrom: "2026-10-27",
    validTo: "2026-11-02",
    sourceUrl: "https://example.com/folheto.pdf",
    productType: "Mercearia",
    productTypes: ["Mercearia"],
    ...overrides,
  };
}

function snapshot(count, overrides = {}) {
  return {
    storeId: "bigbom",
    store: { name: "Big Bom", branch: "Vila Zanetti", sourceUrl: "https://example.com/folheto.pdf", from: "2026-10-27", to: "2026-11-02" },
    offers: Array.from({ length: count }, (_, i) => offer(i + 1)),
    ...overrides,
  };
}

test("a snapshot with a similar count and sane prices passes", () => {
  const result = checkPlausibility(snapshot(100), snapshot(95), NOW);
  assert.equal(result.ok, true, result.reasons.join("; "));
});

test("a large change in offer count is flagged", () => {
  const result = checkPlausibility(snapshot(100), snapshot(40), NOW);
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /contagem/);
});

test("absurd prices are flagged", () => {
  const next = snapshot(10);
  next.offers[3] = offer(4, { price: 9999 });
  const result = checkPlausibility(snapshot(10), next, NOW);
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /acima de R\$ 500/);
});

test("a snapshot with no offer valid today is flagged", () => {
  const next = snapshot(10);
  next.offers = next.offers.map((item) => ({ ...item, validFrom: "2026-09-01", validTo: "2026-09-07" }));
  const result = checkPlausibility(snapshot(10), next, NOW);
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /válida hoje/);
});

test("without a previous snapshot nothing is cleared automatically", () => {
  const result = checkPlausibility(null, snapshot(10), NOW);
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /sem snapshot anterior/);
});
