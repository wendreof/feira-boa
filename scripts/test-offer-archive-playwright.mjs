/**
 * Playwright: archived encarte section (grayscale cards, Encerrado sticker).
 * Run: npm run build && npm run test:archive-ui
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.env.SITE_URL || "http://127.0.0.1:8790";
const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server not reachable at ${url}. Start: node scripts/dev-static-server.mjs`);
}

function startServerIfNeeded() {
  return new Promise((resolve) => {
    fetch(`${BASE}/index.html`, { signal: AbortSignal.timeout(1500) })
      .then((r) => resolve(r.ok ? null : "start"))
      .catch(() => {
        const child = spawn(process.execPath, ["scripts/dev-static-server.mjs"], {
          cwd: ROOT,
          stdio: "ignore",
          detached: true,
        });
        child.unref();
        resolve("started");
      });
  });
}

function loadArchiveFixture() {
  const feed = JSON.parse(readFileSync(`${ROOT}/offers.json`, "utf8"));
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

async function dismissLoginGate(page) {
  const cancel = page.locator("#login-gate-cancel");
  if (await cancel.isVisible({ timeout: 5000 }).catch(() => false)) {
    await cancel.click();
  }
}

const serverNote = await startServerIfNeeded();
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
