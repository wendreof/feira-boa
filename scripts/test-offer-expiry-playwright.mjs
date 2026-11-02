/**
 * Playwright: expiry highlight placement on index (list footer vs grid sticker).
 * Run: npm run build && npm run test:expiry-ui
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { expiryHighlightLabel } from "../src/view/format.ts";

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

function loadOffersById() {
  const feed = JSON.parse(readFileSync(`${ROOT}/offers.json`, "utf8"));
  return new Map(feed.offers.map((offer) => [offer.id, offer]));
}

async function dismissLoginGate(page) {
  const cancel = page.locator("#login-gate-cancel");
  if (await cancel.isVisible({ timeout: 5000 }).catch(() => false)) {
    await cancel.click();
  }
}

async function collectCardExpiryDom(page) {
  return page.evaluate(() => {
    const grid = document.querySelector("#offer-grid");
    const listView = grid?.classList.contains("list-view") ?? false;
    const expiring = [...document.querySelectorAll(".offer-card.is-expiring-soon")];
    const normal = [...document.querySelectorAll(".offer-card:not(.is-expiring-soon)")].slice(0, 20);
    const sample = [...expiring, ...normal];
    return sample.map((card) => {
      const footer = card.querySelector(".card-source");
      const link = footer?.querySelector("a");
      const flag = footer?.querySelector(".offer-expiry-flag");
      const linkIndex = link && footer ? [...footer.children].indexOf(link) : -1;
      const flagIndex = flag && footer ? [...footer.children].indexOf(flag) : -1;
      const flagVisible = flag
        ? !flag.hidden && getComputedStyle(flag).display !== "none" && getComputedStyle(flag).visibility !== "hidden"
        : false;
      return {
        id: card.dataset.offerId ?? "",
        listView,
        footerFlagText: flagVisible ? flag.textContent?.trim() ?? "" : null,
        flagAfterVerOferta: linkIndex >= 0 && flagIndex > linkIndex,
        titleHasFlag: Boolean(card.querySelector(".card-title .offer-expiry-flag:not([hidden])")),
        validHasFlag: Boolean(card.querySelector(".valid-until .offer-expiry-flag:not([hidden])")),
        stickerVisible: (() => {
          const sticker = card.querySelector(".offer-sticker");
          if (!sticker) return false;
          return getComputedStyle(sticker).display !== "none";
        })(),
        stickerText: card.querySelector(".offer-sticker")?.textContent?.trim() ?? "",
      };
    });
  });
}

function assertListViewCards(cards, offersById, failures) {
  for (const card of cards) {
    if (!card.listView) {
      failures.push("expected list view on mobile viewport");
      break;
    }
    const offer = offersById.get(card.id);
    if (!offer) continue;
    const expected = expiryHighlightLabel(offer);
    if (card.titleHasFlag) failures.push(`${card.id}: expiry flag must not appear in title (list)`);
    if (card.validHasFlag) failures.push(`${card.id}: expiry flag must not appear under dates (list)`);
    if (expected) {
      if (card.footerFlagText !== expected) {
        failures.push(`${card.id}: expected footer "${expected}", got "${card.footerFlagText ?? "none"}"`);
      }
      if (!card.flagAfterVerOferta) failures.push(`${card.id}: expiry flag must follow ver oferta link`);
    } else if (card.footerFlagText) {
      failures.push(`${card.id}: unexpected footer flag "${card.footerFlagText}"`);
    }
    if (card.stickerVisible) failures.push(`${card.id}: sticker should be hidden in list view`);
  }
}

function assertGridViewCards(cards, offersById, failures) {
  for (const card of cards) {
    if (card.listView) {
      failures.push("expected grid view on desktop viewport");
      break;
    }
    const offer = offersById.get(card.id);
    if (!offer) continue;
    const expected = expiryHighlightLabel(offer);
    if (card.footerFlagText) failures.push(`${card.id}: footer flag should be hidden in grid`);
    if (expected) {
      if (!card.stickerVisible) failures.push(`${card.id}: expected visible expiry sticker in grid`);
      if (card.stickerText !== expected) {
        failures.push(`${card.id}: expected sticker "${expected}", got "${card.stickerText}"`);
      }
    }
  }
}

const serverNote = await startServerIfNeeded();
if (serverNote === "started") await waitForServer(`${BASE}/index.html`);
const offersById = loadOffersById();
const failures = [];

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-dev-shm-usage", "--disable-gpu"],
});
try {
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await dismissLoginGate(mobile);
  await mobile.locator(".offer-card").first().waitFor({ state: "visible", timeout: 30_000 });
  assertListViewCards(await collectCardExpiryDom(mobile), offersById, failures);

  const desktop = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await desktop.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await dismissLoginGate(desktop);
  await desktop.locator(".offer-card").first().waitFor({ state: "visible", timeout: 30_000 });
  await desktop.locator('[data-view-mode="grid"]').click();
  await desktop.locator("#offer-grid:not(.list-view)").waitFor({ timeout: 5000 });
  assertGridViewCards(await collectCardExpiryDom(desktop), offersById, failures);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("Offer expiry UI checks failed:");
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(`OK: list footer + grid sticker expiry layout verified on ${BASE}`);
if (serverNote === "started") console.log("(Started embedded static server on 8790 for this run.)");
