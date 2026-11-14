/**
 * Playwright check: main grocery logos on /lojas.html load and show has-logo.
 * Run: node scripts/dev-static-server.mjs (terminal 1)
 *      node scripts/test-store-logos-playwright.mjs
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import {
  SITE_URL,
  dismissLoginGate,
  ensureStaticServer,
  waitForServer,
} from "./test/playwright-harness.mjs";

const BASE = SITE_URL;
/** Optional: FEIRA_E2E_EMAIL + FEIRA_E2E_PASSWORD in env (never commit). */
const E2E_EMAIL = process.env.FEIRA_E2E_EMAIL || "";
const E2E_PASSWORD = process.env.FEIRA_E2E_PASSWORD || "";
const MAIN_STORES = [
  { id: "semprevale", src: "logos/semprevale.png" },
  { id: "bigbom", src: "logos/bigbom.png" },
  { id: "paguemenos", src: "logos/paguemenos.png" },
  { id: "spassosabores", src: "logos/spasso.png" },
  { id: "corso", src: "logos/corso.png" },
  { id: "spani", src: "logos/spani.png" },
];

const serverNote = await ensureStaticServer("/lojas.html");
if (serverNote === "started") await waitForServer(`${BASE}/lojas.html`);

const browser = await chromium.launch({ headless: true });

async function signInIfConfigured(page) {
  if (!E2E_EMAIL || !E2E_PASSWORD) return;
  await page.goto(`${BASE}/login.html?returnTo=${encodeURIComponent("/lojas.html")}`, { waitUntil: "networkidle" });
  await page.locator("#auth-email").fill(E2E_EMAIL);
  await page.locator("#auth-password").fill(E2E_PASSWORD);
  await page.locator("#auth-submit").click();
  await page.waitForURL(/lojas\.html/, { timeout: 20_000 });
}

async function openLojas(page) {
  if (E2E_EMAIL && E2E_PASSWORD) {
    await signInIfConfigured(page);
  } else {
    await page.goto(`${BASE}/lojas.html`, { waitUntil: "networkidle", timeout: 30_000 });
    await dismissLoginGate(page);
  }
}

async function checkStoreLogos(page, failures) {
  for (const store of MAIN_STORES) {
    const card = page.locator(`.store-source[data-store-id="${store.id}"]`);
    const logo = card.locator(".source-logo");
    const img = logo.locator("img");
    const fallback = logo.locator(".source-logo-fallback");

    if (!(await card.count())) {
      failures.push(`${store.id}: card missing`);
      continue;
    }
    const src = await img.getAttribute("src");
    if (src !== store.src) failures.push(`${store.id}: expected src ${store.src}, got ${src ?? "none"}`);

    await img.waitFor({ state: "visible", timeout: 10_000 });
    await logo.waitFor({ state: "attached" });
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        const image = el?.querySelector("img");
        return Boolean(el?.classList.contains("has-logo") && image && image.naturalWidth > 0);
      },
      `.store-source[data-store-id="${store.id}"] .source-logo`,
      { timeout: 10_000 },
    ).catch(() => {
      failures.push(`${store.id}: image did not load or has-logo missing`);
    });

    const naturalWidth = await img.evaluate((el) => (el instanceof HTMLImageElement ? el.naturalWidth : 0));
    if (naturalWidth <= 0 && !failures.some((f) => f.startsWith(store.id))) {
      failures.push(`${store.id}: image failed to load (${src})`);
    }

    const fallbackVisible = await fallback.evaluate((el) => getComputedStyle(el).display !== "none");
    if (fallbackVisible) failures.push(`${store.id}: initials fallback still visible`);
  }

  const forte = page.locator('.store-source[data-store-id="forte-mix"] .source-logo');
  const forteImg = forte.locator("img");
  await forte.waitFor({ state: "attached" });
  if (!(await forteImg.count())) {
    failures.push("forte-mix: expected logo img");
  } else {
    const forteOk = await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        const image = el?.querySelector("img");
        return Boolean(el?.classList.contains("has-logo") && image && image.naturalWidth > 0);
      },
      `.store-source[data-store-id="forte-mix"] .source-logo`,
      { timeout: 8000 },
    ).then(() => true).catch(() => false);
    if (!forteOk) failures.push("forte-mix: logo did not load or has-logo missing");
  }
}

async function checkDesktopStoreCardLayout(page) {
  const layoutFailures = [];
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto(`${BASE}/lojas.html`, { waitUntil: "networkidle", timeout: 30_000 });
  await dismissLoginGate(page);

  await page.waitForFunction(
    () => document.querySelector(".store-source[data-store-id='spassosabores'] .source-actions .source-button--flyer"),
    undefined,
    { timeout: 12_000 },
  ).catch(() => {
    layoutFailures.push("desktop: spassosabores flyer buttons not injected from offers.json");
  });

  await page.waitForFunction(
    () => getComputedStyle(document.querySelector(".store-source[data-store-id='spassosabores']") || document.body).display === "grid",
    undefined,
    { timeout: 8000 },
  ).catch(() => {
    layoutFailures.push("desktop: .store-source grid layout not applied");
  });

  const spassoLayout = await page.evaluate(() => {
    const card = document.querySelector(".store-source[data-store-id='spassosabores']");
    const copy = card?.querySelector(".source-copy");
    const strong = copy?.querySelector("strong");
    const actions = card?.querySelector(".source-actions");
    const strongRect = strong?.getBoundingClientRect();
    const buttons = actions ? [...actions.querySelectorAll(".source-button")] : [];
    const tops = buttons.map((button) => Math.round(button.getBoundingClientRect().top));
    return {
      cardDisplay: card ? getComputedStyle(card).display : "",
      copyWidth: copy?.getBoundingClientRect().width ?? 0,
      strongHeight: strongRect?.height ?? 0,
      actionsDisplay: actions ? getComputedStyle(actions).display : "",
      actionButtonRows: new Set(tops).size,
      actionButtonCount: buttons.length,
    };
  });

  if (spassoLayout.cardDisplay !== "grid") {
    layoutFailures.push(`desktop: spassosabores card display is ${spassoLayout.cardDisplay}, expected grid`);
  }
  if (spassoLayout.copyWidth < 320) {
    layoutFailures.push(`desktop: spassosabores copy column too narrow (${Math.round(spassoLayout.copyWidth)}px)`);
  }
  if (spassoLayout.strongHeight > 72) {
    layoutFailures.push(`desktop: spassosabores title wraps too tall (${Math.round(spassoLayout.strongHeight)}px)`);
  }
  if (spassoLayout.actionsDisplay && spassoLayout.actionsDisplay !== "grid") {
    layoutFailures.push(`desktop: source-actions display is ${spassoLayout.actionsDisplay}, expected grid`);
  }
  if (spassoLayout.actionButtonCount >= 4 && spassoLayout.actionButtonRows < 2) {
    layoutFailures.push(`desktop: spassosabores actions stuck in one row (${spassoLayout.actionButtonCount} buttons)`);
  }

  const forteLayout = await page.evaluate(() => {
    const card = document.querySelector(".store-source[data-store-id='forte-mix']");
    const copy = card?.querySelector(".source-copy");
    return { copyWidth: copy?.getBoundingClientRect().width ?? 0 };
  });
  if (forteLayout.copyWidth < 320) {
    layoutFailures.push(`desktop: forte-mix copy column too narrow (${Math.round(forteLayout.copyWidth)}px)`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await dismissLoginGate(page);

  const mobileSpassoAfter = await page.evaluate(() => {
    const card = document.querySelector(".store-source[data-store-id='spassosabores']");
    const copy = card?.querySelector(".source-copy");
    return {
      cardDisplay: card ? getComputedStyle(card).display : "",
      copyWidth: copy?.getBoundingClientRect().width ?? 0,
    };
  });

  if (mobileSpassoAfter.cardDisplay !== "grid") {
    layoutFailures.push(`mobile: spassosabores card display is ${mobileSpassoAfter.cardDisplay}, expected grid`);
  }
  if (mobileSpassoAfter.copyWidth < 200) {
    layoutFailures.push(`mobile: spassosabores copy column too narrow (${Math.round(mobileSpassoAfter.copyWidth)}px)`);
  }

  await page.screenshot({ path: ".playwright-mcp/lojas-logos-desktop.png", fullPage: true });
  return layoutFailures;
}

const failures = [];
try {
  mkdirSync(".playwright-mcp", { recursive: true });

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await openLojas(mobilePage);
  await checkStoreLogos(mobilePage, failures);
  await mobilePage.screenshot({ path: ".playwright-mcp/lojas-logos-mobile.png", fullPage: true });

  const desktopPage = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await openLojas(desktopPage);
  failures.push(...await checkDesktopStoreCardLayout(desktopPage));
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("Store logo checks failed:");
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(`OK: ${MAIN_STORES.length} main store logos loaded on ${BASE}/lojas.html (mobile + desktop layout)`);
if (serverNote === "started") console.log("(Started embedded static server on 8790 for this run.)");
