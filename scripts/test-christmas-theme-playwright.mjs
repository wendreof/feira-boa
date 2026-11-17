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
  await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const flag = await page.locator("html").getAttribute("data-christmas");
  if (flag !== "on") failures.push(`data-christmas was ${flag}`);

  const hatBg = await page.evaluate(() => {
    const brand = document.querySelector(".topbar .brand");
    const sidebar = document.querySelector(".sidebar-brand-mark");
    const topbarHat = brand ? getComputedStyle(brand, "::after").backgroundImage : "";
    const sidebarHat = sidebar ? getComputedStyle(sidebar, "::after").backgroundImage : "";
    return { topbarHat, sidebarHat };
  });
  if (!hatBg.topbarHat || hatBg.topbarHat === "none") failures.push("santa hat ::after missing on .topbar .brand");
  if (!hatBg.topbarHat.includes("santa-hat.svg")) failures.push(`topbar hat asset unexpected: ${hatBg.topbarHat}`);
  if (!hatBg.sidebarHat || hatBg.sidebarHat === "none") failures.push("santa hat ::after missing on .sidebar-brand-mark");
  if (!hatBg.sidebarHat.includes("santa-hat.svg")) failures.push(`sidebar hat asset unexpected: ${hatBg.sidebarHat}`);

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

console.log(`OK: christmas theme on by default at ${BASE}/index.html`);