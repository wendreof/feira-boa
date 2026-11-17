/**
 * Christmas accents: data flag, santa hat pseudo, reduced layout shift on mobile.
 * Run: node scripts/test-christmas-theme-playwright.mjs
 */
import { chromium } from "playwright";
import { SITE_URL, ensureStaticServer, waitForServer } from "./test/playwright-harness.mjs";

const BASE = SITE_URL;

const serverNote = await ensureStaticServer("/index.html");
if (serverNote === "started") await waitForServer(`${BASE}/index.html`);

const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${BASE}/index.html?christmas=1`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const flag = await page.locator("html").getAttribute("data-christmas");
  if (flag !== "on") failures.push(`data-christmas was ${flag}`);

  const hatBg = await page.evaluate(() => {
    const brand = document.querySelector(".brand");
    return brand ? getComputedStyle(brand, "::after").backgroundImage : "";
  });
  if (!hatBg || hatBg === "none") failures.push("santa hat ::after missing on .brand");

  const topbarBox = await page.locator(".topbar").boundingBox();
  if (!topbarBox || topbarBox.height > 120) failures.push("topbar height looks broken on mobile");

  await page.goto(`${BASE}/index.html?christmas=0`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const offFlag = await page.locator("html").getAttribute("data-christmas");
  if (offFlag === "on") failures.push("christmas=0 should disable theme");
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("Christmas theme checks failed:");
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(`OK: christmas theme preview at ${BASE}/index.html?christmas=1`);