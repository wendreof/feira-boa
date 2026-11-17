/**
 * Christmas CSS theme still gates on date / ?christmas=1.
 * Brand marks (favicon, topbar, apple-touch) are year-round — no query required.
 * Run: node scripts/test-christmas-theme-playwright.mjs
 */
import { chromium } from "playwright";
import {
  isChristmasSeasonDate,
  todayIsoInTimeZone,
} from "./domain/christmas-season.mjs";
import { SITE_URL, ensureStaticServer, waitForServer } from "./test/playwright-harness.mjs";

const BASE = SITE_URL;
const calendarInSeason = isChristmasSeasonDate(todayIsoInTimeZone());

const serverNote = await ensureStaticServer("/index.html");
if (serverNote === "started") await waitForServer(`${BASE}/index.html`);

const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const flag = await page.locator("html").getAttribute("data-christmas");
  if (calendarInSeason) {
    if (flag !== "on") failures.push(`data-christmas should be on in season, was ${flag}`);
  } else if (flag === "on") {
    failures.push(`data-christmas should be off outside season, was ${flag}`);
  }

  const defaultMarks = await page.evaluate(() => {
    const brand = document.querySelector(".topbar .brand img.brand-mark");
    const sidebar = document.querySelector(".sidebar-brand-mark img");
    const icon = document.querySelector('link[rel="icon"]');
    const manifest = document.querySelector('link[rel="manifest"]');
    const apple = document.querySelector('link[rel="apple-touch-icon"]');
    return {
      brandSrc: brand?.getAttribute("src") ?? "",
      sidebarSrc: sidebar?.getAttribute("src") ?? "",
      iconHref: icon?.getAttribute("href") ?? "",
      manifestHref: manifest?.getAttribute("href") ?? "",
      appleHref: apple?.getAttribute("href") ?? "",
    };
  });
  if (!defaultMarks.brandSrc.includes("favicon.svg?v=") || defaultMarks.brandSrc.includes("favicon-christmas")) {
    failures.push(`topbar brand-mark should be cache-busted favicon.svg (${defaultMarks.brandSrc})`);
  }
  if (!defaultMarks.sidebarSrc.includes("favicon.svg?v=") || defaultMarks.sidebarSrc.includes("favicon-christmas")) {
    failures.push(`sidebar brand should be cache-busted favicon.svg (${defaultMarks.sidebarSrc})`);
  }
  if (!defaultMarks.iconHref.includes("favicon.svg?v=") || defaultMarks.iconHref.includes("favicon-christmas")) {
    failures.push(`link icon href should be cache-busted favicon.svg (${defaultMarks.iconHref})`);
  }
  if (defaultMarks.manifestHref !== "manifest.webmanifest") {
    failures.push(`manifest should stay default without query (${defaultMarks.manifestHref})`);
  }
  if (!defaultMarks.appleHref.includes("icon-192.png") || defaultMarks.appleHref.includes("christmas")) {
    failures.push(`apple-touch-icon should be default icon-192.png (${defaultMarks.appleHref})`);
  }

  const faviconBody = await page.evaluate(async () => {
    const response = await fetch("favicon.svg", { cache: "no-store" });
    const text = await response.text();
    return { ok: response.ok, length: text.length, hasPng: text.includes("data:image/png;base64,") };
  });
  if (!faviconBody.ok || !faviconBody.hasPng || faviconBody.length < 8_000) {
    failures.push(`favicon.svg on / without query must be the embedded reference tile (${JSON.stringify(faviconBody)})`);
  }

  const brandLoads = await page.evaluate(async () => {
    const img = document.querySelector(".sidebar-brand-mark img");
    if (!(img instanceof HTMLImageElement) || !img.src) return { ok: false, reason: "missing brand img src" };
    if (img.naturalWidth > 0) return { ok: true };
    const response = await fetch(img.src, { cache: "no-store" });
    return { ok: response.ok, status: response.status, src: img.src };
  });
  if (!brandLoads.ok) failures.push(`default favicon must load for brand mark (${JSON.stringify(brandLoads)})`);

  await page.goto(`${BASE}/lojas.html`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const nestedIcon = await page.locator('link[rel="icon"]').getAttribute("href");
  if (!nestedIcon?.includes("favicon.svg") || nestedIcon.includes("favicon-christmas")) {
    failures.push(`nested /lojas.html favicon should be default (${nestedIcon})`);
  }

  await page.goto(`${BASE}/index.html?christmas=1`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const previewFlag = await page.locator("html").getAttribute("data-christmas");
  if (previewFlag !== "on") failures.push(`data-christmas should be on with ?christmas=1, was ${previewFlag}`);

  const previewBrand = await page.locator(".topbar .brand img.brand-mark").getAttribute("src");
  if (!previewBrand?.includes("favicon.svg") || previewBrand.includes("favicon-christmas")) {
    failures.push(`theme preview must not swap brand href (${previewBrand})`);
  }

  const overlayHat = await page.evaluate(() => {
    const brand = document.querySelector(".topbar .brand");
    const sidebar = document.querySelector(".sidebar-brand-mark");
    const brandAfter = brand ? getComputedStyle(brand, "::after").content : "";
    const sidebarAfter = sidebar ? getComputedStyle(sidebar, "::after").content : "";
    return { brandAfter, sidebarAfter };
  });
  if (overlayHat.brandAfter && overlayHat.brandAfter !== "none" && overlayHat.brandAfter !== '""') {
    failures.push("unexpected ::after hat overlay on .topbar .brand");
  }
  if (overlayHat.sidebarAfter && overlayHat.sidebarAfter !== "none" && overlayHat.sidebarAfter !== '""') {
    failures.push("unexpected ::after hat overlay on .sidebar-brand-mark");
  }

  const topbarBox = await page.locator(".topbar").boundingBox();
  if (!topbarBox || topbarBox.height > 120) failures.push("topbar height looks broken on mobile");

  await page.goto(`${BASE}/index.html?christmas=0`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const offFlag = await page.locator("html").getAttribute("data-christmas");
  if (offFlag === "on") failures.push("christmas=0 should disable theme");

  const offBrand = await page.locator(".topbar .brand img.brand-mark").getAttribute("src");
  if (!offBrand?.includes("favicon.svg") || offBrand.includes("favicon-christmas")) {
    failures.push(`christmas=0 should keep favicon.svg (${offBrand})`);
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("Christmas theme checks failed:");
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(
  `OK: year-round brand icons on / and nested pages; CSS theme gating (inSeason=${calendarInSeason}) at ${BASE}/index.html`,
);
