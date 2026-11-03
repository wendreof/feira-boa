/**
 * Mobile: categories + logo store chips; Filtros panel hidden.
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
    fetch(`${BASE}/index.html`, { signal: AbortSignal.timeout(1500) })
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
if (serverNote === "started") await waitForServer(`${BASE}/index.html`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const failures = [];

try {
  await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const cancel = page.locator("#login-gate-cancel");
  if (await cancel.isVisible({ timeout: 4000 }).catch(() => false)) await cancel.click();

  await page.waitForSelector("#popular-items .popular-item", { timeout: 30_000 });
  await page.waitForSelector("#store-filters .store-filter-chip", { timeout: 30_000 });

  const filtersHidden = await page.locator(".sticky-filters").evaluate((el) => getComputedStyle(el).display === "none");
  if (filtersHidden) failures.push("store filter strip should be visible on mobile");

  const advancedHidden = await page.locator("#filter-disclosure").evaluate((el) => getComputedStyle(el).display === "none");
  if (!advancedHidden) failures.push("Filtros panel should be hidden on mobile");

  const logoChip = page.locator('#store-filters button.has-store-logo img[src*="logos/"]').first();
  if (!(await logoChip.count())) failures.push("expected at least one store chip with logo");

  const favoritesPanelHidden = await page.locator("#account-panel").evaluate((el) => {
    const style = getComputedStyle(el);
    return el.hidden || style.display === "none";
  });
  if (!favoritesPanelHidden) failures.push("favorites account panel should stay hidden for guests");

  await page.waitForFunction(() => {
    const invite = document.querySelector("#alerts-invite");
    return invite && !invite.hidden;
  }, null, { timeout: 15_000 }).catch(() => {
    failures.push("alerts invite panel should show for guests");
  });
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("Mobile store chips layout failed:");
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(`OK: mobile categories + store logos at ${BASE}/index.html`);
