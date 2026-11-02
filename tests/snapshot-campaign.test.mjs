import assert from "node:assert/strict";
import test from "node:test";
import {
  ARCHIVE_OFFER_CAP,
  archivedOfferId,
  campaignFingerprint,
  snapshotCampaignChanged,
} from "../scripts/domain/snapshot-campaign.mjs";

test("campaignFingerprint reads store metadata", () => {
  assert.deepEqual(campaignFingerprint({
    store: { sourceUrl: "https://a.test/f.pdf", from: "2026-11-02", to: "2026-11-04" },
  }), {
    sourceUrl: "https://a.test/f.pdf",
    from: "2026-11-02",
    to: "2026-11-04",
  });
});

test("snapshotCampaignChanged detects flyer or validity rotation", () => {
  const base = { store: { sourceUrl: "https://a.test/1.pdf", from: "2026-10-29", to: "2026-11-01" } };
  assert.equal(snapshotCampaignChanged(base, {
    store: { sourceUrl: "https://a.test/2.pdf", from: "2026-11-02", to: "2026-11-04" },
  }), true);
  assert.equal(snapshotCampaignChanged(base, {
    store: { sourceUrl: "https://a.test/1.pdf", from: "2026-10-29", to: "2026-11-01" },
  }), false);
});

test("archivedOfferId stays URL-safe", () => {
  assert.match(archivedOfferId("sempre", "Café-500g-2026-11-01"), /^arch-[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test("archive cap is a positive limit", () => {
  assert.ok(ARCHIVE_OFFER_CAP >= 50);
});
