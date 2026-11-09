import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogFeedFingerprint,
  catalogPushAlreadySentToday,
} from "../scripts/domain/catalog-feed-fingerprint.mjs";

const today = "2026-11-09";

test("catalogFeedFingerprint changes when active offers change", () => {
  const base = {
    updatedAt: "2026-11-09T12:00:00.000Z",
    offers: [
      { id: "a", validFrom: "2026-11-09", validTo: "2026-11-09" },
      { id: "b", validFrom: "2026-11-09", validTo: "2026-11-09" },
    ],
  };
  const a = catalogFeedFingerprint(base, today);
  const b = catalogFeedFingerprint({
    ...base,
    offers: [...base.offers, { id: "c", validFrom: "2026-11-09", validTo: "2026-11-09" }],
  }, today);
  assert.notEqual(a, b);
});

test("catalogPushAlreadySentToday uses America/Sao_Paulo", () => {
  const morningUtc = "2026-11-09T14:00:00.000Z";
  assert.ok(catalogPushAlreadySentToday(morningUtc, today));
  assert.ok(!catalogPushAlreadySentToday("2026-11-08T14:00:00.000Z", today));
});
