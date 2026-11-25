import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  capCorsoCampaignsToFrenteWeekend,
  discoverCorsoFlyerFromHtml,
  extractCorsoFrenteWeekendWindow,
  latestValidityEnd,
  loadCorsoCampaignFile,
  parseCorsoFlyerText,
  parseCorsoValidityHints,
} from "../scripts/domain/corso-flyer.mjs";
import { isOfferActive } from "../scripts/domain/offer-validity.mjs";
import { applyFrenteWeekendCap } from "../scripts/adapters/corso.mjs";

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

test("extractCorsoFrenteWeekendWindow uses frente banner only", async () => {
  const sample = await readFile(fileURLToPath(new URL("./fixtures/corso-flyer-ocr-sample.txt", import.meta.url)), "utf8");
  assert.deepEqual(extractCorsoFrenteWeekendWindow(sample), {
    from: "2026-11-13",
    to: "2026-11-14",
  });
  assert.equal(extractCorsoFrenteWeekendWindow("sem banner de validade"), null);
});

test("capCorsoCampaignsToFrenteWeekend clamps campaigns to frente window", () => {
  const window = { from: "2026-11-13", to: "2026-11-14" };
  const campaigns = [
    { from: "2026-11-10", to: "2026-11-20", offers: [{ name: "A" }] },
    { from: "2026-11-15", to: "2026-11-18", offers: [{ name: "B" }] },
    { from: "2026-11-01", to: "2026-11-05", offers: [{ name: "C" }] },
    { from: "2026-11-20", to: "2026-11-25", offers: [{ name: "D" }] },
  ];
  const capped = capCorsoCampaignsToFrenteWeekend(campaigns, window);
  assert.equal(capped.length, 4);
  assert.deepEqual(capped[0], { from: "2026-11-13", to: "2026-11-14", offers: [{ name: "A" }] });
  assert.deepEqual(capped[1], { from: "2026-11-14", to: "2026-11-14", offers: [{ name: "B" }] });
  assert.deepEqual(capped[2], { from: "2026-11-13", to: "2026-11-13", offers: [{ name: "C" }] });
  assert.deepEqual(capped[3], { from: "2026-11-14", to: "2026-11-14", offers: [{ name: "D" }] });
  assert.deepEqual(capCorsoCampaignsToFrenteWeekend(null, window), null);

  const inverted = capCorsoCampaignsToFrenteWeekend(
    [{ from: "2026-11-14", to: "2026-11-13", offers: [{ name: "E" }] }],
    window,
  );
  assert.deepEqual(inverted[0], { from: "2026-11-14", to: "2026-11-14", offers: [{ name: "E" }] });
});

test("latestValidityEnd picks the farthest campaign end date", () => {
  assert.equal(latestValidityEnd(null), null);
  assert.equal(
    latestValidityEnd([
      { from: "2026-11-13", to: "2026-11-14", offers: [] },
      { from: "2026-11-13", to: "2026-11-20", offers: [] },
    ]),
    "2026-11-20",
  );
});

test("applyFrenteWeekendCap delegates to frente OCR window", async () => {
  const sample = await readFile(fileURLToPath(new URL("./fixtures/corso-flyer-ocr-sample.txt", import.meta.url)), "utf8");
  const campaigns = [{ from: "2026-11-01", to: "2026-11-30", offers: [] }];
  const capped = applyFrenteWeekendCap(campaigns, sample);
  assert.deepEqual(capped[0], { from: "2026-11-13", to: "2026-11-14", offers: [] });
  assert.deepEqual(applyFrenteWeekendCap(campaigns, "no weekend line"), campaigns);
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

test("capCorsoCampaignsToFrenteWeekend clamps gemini windows to frente weekend", () => {
  const campaigns = [
    { from: "2026-11-20", to: "2026-11-26", offers: [{ name: "A" }] },
    { from: "2026-11-20", to: "2026-11-21", offers: [{ name: "B" }] },
  ];
  const capped = capCorsoCampaignsToFrenteWeekend(campaigns, { from: "2026-11-20", to: "2026-11-21" });
  assert.deepEqual(
    capped.map((c) => ({ from: c.from, to: c.to })),
    [
      { from: "2026-11-20", to: "2026-11-21" },
      { from: "2026-11-20", to: "2026-11-21" },
    ],
  );
  const offer = { validFrom: "2026-11-20", validTo: capped[0].to };
  assert.equal(isOfferActive(offer, "2026-11-25"), false);
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
