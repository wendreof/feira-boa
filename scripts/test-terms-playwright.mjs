/**
 * Privacy disclosure is on the terms page and no AdSense script loads.
 * Run: node scripts/test-terms-playwright.mjs
 */
import { chromium } from "playwright";
import { SITE_URL, ensureStaticServer, waitForServer } from "./test/playwright-harness.mjs";

const BASE = SITE_URL;

const serverNote = await ensureStaticServer("/termos.html");
if (serverNote === "started") await waitForServer(`${BASE}/termos.html`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const failures = [];

try {
  await page.goto(`${BASE}/termos.html#privacidade`, { waitUntil: "networkidle", timeout: 30_000 });
  const cancel = page.locator("#login-gate-cancel");
  if (await cancel.isVisible({ timeout: 4000 }).catch(() => false)) await cancel.click();

  const privacy = page.locator("#privacidade");
  if ((await privacy.textContent())?.trim() !== "6. Privacidade") {
    failures.push("privacy heading missing");
  }
  const body = await page.locator(".terms-body").innerText();
  if (!body.includes("exibem anúncios do Google (AdSense)")) failures.push("terms do not say ads are shown");

  const link = page.locator("a.footer-link");
  await link.waitFor({ state: "visible", timeout: 10_000 });
  const href = await link.getAttribute("href");
  if (href !== "termos.html#privacidade") failures.push(`footer href was ${href}`);

  const adScripts = await page.locator('script[src*="googlesyndication"], script[src*="adsbygoogle"]').count();
  if (adScripts !== 0) failures.push(`found ${adScripts} ad script(s)`);

  await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const indexSrc = await page.locator('script[src*="adsbygoogle.js"]').getAttribute("src");
  if (indexSrc !== "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7989265241424368") {
    failures.push(`index ad script was ${indexSrc}`);
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("Terms checks failed:");
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(`OK: privacy section visible and auto ads script on the home page at ${BASE}`);
if (serverNote === "started") console.log("(Started embedded static server on 8790 for this run.)");
