import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  discoverCorsoFlyerFromHtml,
  loadCorsoCampaignFile,
  parseCorsoFlyerText,
  parseCorsoValidityHints,
} from "../scripts/domain/corso-flyer.mjs";

test("discoverCorsoFlyerFromHtml reads jornal hash and image URLs", async () => {
  const html = await readFile(fileURLToPath(new URL("./fixtures/corso-flyer-page.html", import.meta.url)), "utf8");
  const flyer = discoverCorsoFlyerFromHtml(html);
  assert.ok(flyer);
  assert.equal(flyer.hash, "1794507762");
  assert.match(flyer.frenteUrl, /jornal-frente\.jpg\?hash=1794507762/);
  assert.match(flyer.versoUrl, /jornal-verso\.jpg\?hash=1794507762/);
});

test("parseCorsoValidityHints extracts weekend flyer window", async () => {
  const sample = await readFile(fileURLToPath(new URL("./fixtures/corso-flyer-ocr-sample.txt", import.meta.url)), "utf8");
  const hints = parseCorsoValidityHints(sample);
  assert.ok(hints.some((range) => range.from === "2026-11-13" && range.to === "2026-11-14"));
});

test("parseCorsoFlyerText pairs hortifruti price grids from OCR snippet", async () => {
  const sample = await readFile(fileURLToPath(new URL("./fixtures/corso-flyer-ocr-sample.txt", import.meta.url)), "utf8");
  const campaigns = parseCorsoFlyerText(sample);
  assert.ok(campaigns.length >= 1);
  const total = campaigns.reduce((sum, campaign) => sum + campaign.offers.length, 0);
  assert.ok(total >= 3, `expected at least 3 offers, got ${total}`);
  const alface = campaigns.flatMap((c) => c.offers).find((o) => /alface/i.test(o.name));
  assert.ok(alface);
  assert.equal(alface.price, 4.18);
  assert.equal(alface.oldPrice, 5.18);
});

test("loadCorsoCampaignFile accepts legacy array and wrapped cache", () => {
  const legacy = loadCorsoCampaignFile([{ from: "2026-01-01", to: "2026-01-02", offers: [] }]);
  assert.equal(legacy.flyerHash, null);
  assert.equal(legacy.campaigns.length, 1);

  const wrapped = loadCorsoCampaignFile({
    flyerHash: "123",
    campaigns: [{ from: "2026-01-01", to: "2026-01-02", offers: [] }],
  });
  assert.equal(wrapped.flyerHash, "123");
});
