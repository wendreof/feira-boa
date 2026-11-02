/**
 * Playwright check: main grocery logos on /lojas.html load and show has-logo.
 * Run: node scripts/dev-static-server.mjs (terminal 1)
 *      node scripts/test-store-logos-playwright.mjs
 */
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.env.SITE_URL || "http://127.0.0.1:8790";
/** Optional: FEIRA_E2E_EMAIL + FEIRA_E2E_PASSWORD in env (never commit). */
const E2E_EMAIL = process.env.FEIRA_E2E_EMAIL || "";
const E2E_PASSWORD = process.env.FEIRA_E2E_PASSWORD || "";
const MAIN_STORES = [
  { id: "semprevale", src: "logos/semprevale.png" },
  { id: "bigbom", src: "logos/bigbom.png" },
  { id: "paguemenos", src: "logos/paguemenos.png" },
  { id: "spassosabores", src: "logos/spasso.png" },
  { id: "corso", src: "logos/corso.png" },
];

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
    fetch(`${BASE}/lojas.html`, { signal: AbortSignal.timeout(1500) })
      .then((r) => resolve(r.ok ? null : "start"))
      .catch(() => {
        const child = spawn(process.execPath, ["scripts/dev-static-server.mjs"], {
          cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
          stdio: "ignore",
          detached: true,
        });
        child.unref();
        resolve("started");
      });
  });
}

const serverNote = await startServerIfNeeded();
if (serverNote === "started") await waitForServer(`${BASE}/lojas.html`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function dismissLoginGate() {
  const cancel = page.locator("#login-gate-cancel");
  if (await cancel.isVisible({ timeout: 8000 }).catch(() => false)) {
    await cancel.click();
    await page.locator(".login-prompt").waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }
}

async function signInIfConfigured() {
  if (!E2E_EMAIL || !E2E_PASSWORD) return;
  await page.goto(`${BASE}/login.html?returnTo=${encodeURIComponent("/lojas.html")}`, { waitUntil: "networkidle" });
  await page.locator("#auth-email").fill(E2E_EMAIL);
  await page.locator("#auth-password").fill(E2E_PASSWORD);
  await page.locator("#auth-submit").click();
  await page.waitForURL(/lojas\.html/, { timeout: 20_000 });
}

const failures = [];
try {
  if (E2E_EMAIL && E2E_PASSWORD) {
    await signInIfConfigured();
  } else {
    await page.goto(`${BASE}/lojas.html`, { waitUntil: "networkidle", timeout: 30_000 });
    await dismissLoginGate();
  }

  mkdirSync(".playwright-mcp", { recursive: true });

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

  // Secondary local store: initials only, no img
  const forte = page.locator('.store-source[data-store-id="forte-mix"] .source-logo');
  if (await forte.locator("img").count()) {
    failures.push("forte-mix: should use initials only (no img)");
  }

  await page.screenshot({ path: ".playwright-mcp/lojas-logos-mobile.png", fullPage: true });
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("Store logo checks failed:");
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(`OK: ${MAIN_STORES.length} main store logos loaded on ${BASE}/lojas.html`);
if (serverNote === "started") console.log("(Started embedded static server on 8790 for this run.)");
