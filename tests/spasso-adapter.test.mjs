import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  campaignCacheIsActive,
  discoverSpassoFlyersFromHtml,
  hashSpassoFlyerSet,
  loadSpassoCampaignFile,
} from "../scripts/domain/spasso-flyer.mjs";

test("discoverSpassoFlyersFromHtml collects newest flyer families and hash", async () => {
  const html = await readFile(fileURLToPath(new URL("./fixtures/spasso-offers-page.html", import.meta.url)), "utf8");
  const flyer = discoverSpassoFlyersFromHtml(html);
  assert.ok(flyer);
  assert.equal(flyer.imageUrls.length, 3);
  assert.ok(flyer.imageUrls.every((url) => /2026\/11\//.test(url)));
  assert.equal(flyer.hash, hashSpassoFlyerSet(flyer.imageUrls));
});

test("hashSpassoFlyerSet is stable regardless of input order", () => {
  const urls = [
    "https://spassosabores.com.br/wp-content/uploads/2026/11/FLV-SPASSO-2.png",
    "https://spassosabores.com.br/wp-content/uploads/2026/11/ACOUGUE-SPASSO-2.png",
  ];
  const reversed = [...urls].reverse();
  assert.equal(hashSpassoFlyerSet(urls), hashSpassoFlyerSet(reversed));
});

test("loadSpassoCampaignFile accepts legacy array and wrapped cache", () => {
  const legacy = loadSpassoCampaignFile([{ from: "2026-01-01", to: "2026-01-02", offers: [] }]);
  assert.equal(legacy.flyerHash, null);
  assert.equal(legacy.campaigns.length, 1);

  const wrapped = loadSpassoCampaignFile({
    flyerHash: "abc123",
    campaigns: [{ from: "2026-01-01", to: "2026-01-02", offers: [] }],
  });
  assert.equal(wrapped.flyerHash, "abc123");
});

test("campaignCacheIsActive is false when every campaign ended before today", () => {
  assert.equal(
    campaignCacheIsActive([
      { from: "2026-11-03", to: "2026-11-07" },
      { from: "2026-08-12", to: "2026-08-14" },
    ]),
    false,
    "2026-11-17",
  );
  assert.equal(campaignCacheIsActive([{ from: "2026-11-17", to: "2026-11-22" }], "2026-11-17"), true);
});
