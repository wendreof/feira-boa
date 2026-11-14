/**
 * Playwright: archived encarte section (grayscale cards, Encerrado sticker).
 * Run: npm run build && npm run test:archive-ui
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import {
  SITE_URL,
  dismissLoginGate,
  ensureStaticServer,
  repoRootPath,
  waitForServer,
} from "./test/playwright-harness.mjs";

const BASE = SITE_URL;

function loadArchiveFixture() {
  const feed = JSON.parse(readFileSync(`${repoRootPath()}/offers.json`, "utf8"));
  const campaign = (feed.archivedCampaigns ?? []).find((entry) => Array.isArray(entry.offers) && entry.offers.length > 0);
  if (!campaign) {
    throw new Error("offers.json has no archivedCampaigns with offers — seed state/previous/ and rebuild the feed.");
  }
  return {
    storeName: campaign.store.name,
    sampleId: campaign.offers[0].id,
    count: campaign.offers.length,
  };
}

const serverNote = await ensureStaticServer("/index.html");
if (serverNote === "started") await waitForServer(`${BASE}/index.html`);
const fixture = loadArchiveFixture();
const failures = [];

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-dev-shm-usage", "--disable-gpu"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await dismissLoginGate(page);
  await page.locator("#store-filters button[data-store]").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.locator(".offer-card").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("#archive-section:not([hidden])").waitFor({ timeout: 15_000 });

  await page.locator(`#store-filters button[data-store="${fixture.storeName}"]`).click();
  await page.locator("#archive-section:not([hidden])").waitFor({ timeout: 15_000 });

  const archiveStats = await page.evaluate((sampleId) => {
    const section = document.querySelector("#archive-section");
    const grid = document.querySelector("#offer-grid-archive");
    const cards = grid ? [...grid.querySelectorAll(".offer-card.is-archived")] : [];
    const sample = grid?.querySelector(`[data-offer-id="${sampleId}"]`);
    const sticker = sample?.querySelector(".offer-sticker");
    const activeHasArchived = Boolean(document.querySelector("#offer-grid .offer-card.is-archived"));
    const subtitle = document.querySelector("#archive-subtitle")?.textContent?.trim() ?? "";
    const grayscale = sample
      ? getComputedStyle(sample).filter.includes("grayscale")
      : false;
    return {
      cardCount: cards.length,
      sampleFound: Boolean(sample),
      stickerText: sticker?.textContent?.trim() ?? "",
      grayscale,
      activeHasArchived,
      subtitle,
      likeDisabled: sample?.querySelector(".offer-reaction-button")?.disabled ?? false,
    };
  }, fixture.sampleId);

  if (archiveStats.cardCount === 0) failures.push("expected archived offer cards in #offer-grid-archive");
  if (!archiveStats.sampleFound) failures.push(`expected archived sample offer ${fixture.sampleId}`);
  if (archiveStats.stickerText !== "Encerrado") {
    failures.push(`expected Encerrado sticker, got "${archiveStats.stickerText}"`);
  }
  if (!archiveStats.grayscale) failures.push("archived card should use grayscale filter");
  if (archiveStats.activeHasArchived) failures.push("active offer grid must not contain .is-archived cards");
  if (!archiveStats.subtitle.includes("encerrada")) {
    failures.push(`archive subtitle should mention encerrada, got "${archiveStats.subtitle}"`);
  }
  if (!archiveStats.likeDisabled) failures.push("archived cards should disable reactions");

  await page.goto(`${BASE}/index.html?view=favorites`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await dismissLoginGate(page);
  await page.waitForTimeout(300);
  const hiddenInFavorites = await page.locator("#archive-section").evaluate((el) => el.hidden);
  if (!hiddenInFavorites) failures.push("archive section must hide in favorites-only view");
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("Offer archive UI checks failed:");
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(`OK: archived encarte UI verified for ${fixture.storeName} (${fixture.count} offers in feed) on ${BASE}`);
if (serverNote === "started") console.log("(Started embedded static server on 8790 for this run.)");
