/**
 * Playwright: login page shows Google and X OAuth buttons.
 * Run: npm run build && node scripts/test-login-oauth-playwright.mjs
 */
import { chromium } from "playwright";
import { SITE_URL, ensureStaticServer, waitForServer } from "./test/playwright-harness.mjs";

const BASE = SITE_URL;
const serverNote = await ensureStaticServer("/login.html");
if (serverNote === "started") await waitForServer(`${BASE}/login.html`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
await page.goto(`${BASE}/login.html`, { waitUntil: "domcontentloaded" });

const google = page.locator("#google-signin");
const xSignIn = page.locator("#x-signin");
await google.waitFor({ state: "visible" });
await xSignIn.waitFor({ state: "visible" });

const labels = await page.locator(".auth-oauth button span").allTextContents();
if (!labels.includes("Continuar com Google") || !labels.includes("Continuar com X")) {
  throw new Error(`Unexpected OAuth labels: ${labels.join(", ")}`);
}

await browser.close();
console.log("login-oauth: OK");