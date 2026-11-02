/**
 * Privacy disclosure is on the terms page and no AdSense script loads.
 * Run: node scripts/test-terms-playwright.mjs
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.env.SITE_URL || "http://127.0.0.1:8790";

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
    fetch(`${BASE}/termos.html`, { signal: AbortSignal.timeout(1500) })
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
