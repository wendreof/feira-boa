import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compareOfferSets,
  compareVisionOfferSets,
  describeFlyerHashAlignment,
  offerAuditKey,
  sanityCheckCampaignFile,
  hasCriticalIssues,
} from "../scripts/domain/flyer-audit.mjs";

describe("flyer-audit", () => {
  it("offerAuditKey folds brand into lookup", () => {
    assert.equal(offerAuditKey({ name: "Cenoura", brand: "", detail: "kg" }), "cenoura|kg");
  });

  it("sanityCheckCampaignFile flags thin caches", () => {
    const issues = sanityCheckCampaignFile({ campaigns: [{ offers: [{ name: "A", price: 1 }] }] }, {
      minOffers: 3,
    });
    assert.ok(hasCriticalIssues(issues));
  });

  it("compareOfferSets detects missing rows and price drift", () => {
    const expected = [{ name: "Banana", brand: "", detail: "kg", price: 3.49 }];
    const actual = [{ name: "Maçã", brand: "", detail: "kg", price: 4.99 }];
    const result = compareOfferSets(expected, actual);
    assert.equal(result.missing.length, 1);
    assert.equal(result.extra.length, 1);
    assert.equal(result.criticalCount, 1);
  });

  it("describeFlyerHashAlignment skips vision when aligned", () => {
    const msg = describeFlyerHashAlignment("123", "123");
    assert.equal(msg.status, "aligned");
    assert.equal(msg.level, "info");
  });

  it("describeFlyerHashAlignment is critical when stale", () => {
    const msg = describeFlyerHashAlignment("999", "123");
    assert.equal(msg.status, "stale");
    assert.equal(msg.level, "critical");
  });

  it("visionAuditKey folds Gemini OCR formatting against manual transcription", () => {
    const manual = { name: "Milho Verde", brand: "", detail: "bandeja", price: 4.98 };
    const gemini = { name: "MILHO VERDE", brand: "", detail: "BDJ", price: 4.98 };
  assert.equal(compareVisionOfferSets([manual], [gemini]).criticalCount, 0);
  });

  it("compareVisionOfferSets tolerates brand placement and flyer abbreviations", () => {
    const expected = [
      { name: "Arroz Tipo 1", brand: "Exxtra", detail: "5kg", price: 17.98 },
      { name: "Abóbora Cabotiá", brand: "", detail: "kg", price: 4.98 },
    ];
    const actual = [
      { name: "ARROZ EXXTRA", brand: "EXXTRA", detail: "5KG TIPO 1", price: 17.98 },
      { name: "ABÓBORA CABOTHIA", brand: "", detail: "Kg", price: 4.98 },
    ];
    const result = compareVisionOfferSets(expected, actual);
    assert.equal(result.criticalCount, 0);
  });

  it("compareVisionOfferSets treats pack totals as matching unit prices", () => {
    const expected = [{ name: "Sabonete", brand: "Lux", detail: "85g pack 6 un", price: 1.98 }];
    const actual = [{ name: "SABONETE LUX", brand: "LUX", detail: "85G 6UN", price: 11.88 }];
    const result = compareVisionOfferSets(expected, actual);
    assert.equal(result.criticalCount, 0);
  });
});