import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compareOfferSets,
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
});