/**
 * Christmas accents: data flag, integrated favicon, reduced layout shift on mobile.
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

  const favicons = await page.evaluate(() => {
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
  if (!favicons.brandSrc.includes("favicon-christmas.svg")) {
    failures.push(`topbar brand-mark src missing favicon-christmas.svg (${favicons.brandSrc})`);
  }
  if (!favicons.sidebarSrc.includes("favicon-christmas.svg")) {
    failures.push(`sidebar brand src missing favicon-christmas.svg (${favicons.sidebarSrc})`);
  }
  if (!favicons.iconHref.includes("favicon-christmas.svg")) {
    failures.push(`link icon href missing favicon-christmas.svg (${favicons.iconHref})`);
  }
  if (!favicons.manifestHref.includes("manifest-christmas.webmanifest")) {
    failures.push(`manifest link should be seasonal (${favicons.manifestHref})`);
  }
  if (!favicons.appleHref.includes("icon-christmas-192.png")) {
    failures.push(`apple-touch-icon should be seasonal (${favicons.appleHref})`);
  }

  const brandLoads = await page.evaluate(async () => {
    const img = document.querySelector(".sidebar-brand-mark img");
    if (!(img instanceof HTMLImageElement) || !img.src) return { ok: false, reason: "missing brand img src" };
    if (img.naturalWidth > 0) return { ok: true };
    const response = await fetch(img.src, { cache: "no-store" });
    return { ok: response.ok, status: response.status, src: img.src };
  });
  if (!brandLoads.ok) failures.push(`favicon-christmas must load for brand mark (${JSON.stringify(brandLoads)})`);

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
    failures.push(`christmas=0 should restore favicon.svg (${offBrand})`);
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("Christmas theme checks failed:");
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(`OK: christmas theme on by default at ${BASE}/index.html`);