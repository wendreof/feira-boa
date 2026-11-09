/**
 * Mobile: categories, store logos, scroll strips, clear filters, list view.
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

  const advancedHidden = await page.locator("#filter-disclosure").evaluate((el) => getComputedStyle(el).display === "none");
  if (!advancedHidden) failures.push("Filtros panel should be hidden on mobile");

  if (!(await page.locator(".horizontal-scroll-strip").count())) {
    failures.push("category/store rows should use horizontal scroll strips");
  }

  const logoChip = page.locator('#store-filters button.has-store-logo img[src*="logos/"]').first();
  if (!(await logoChip.count())) failures.push("expected at least one store chip with logo");

  const storeChipShape = await page.evaluate(() => {
    const chip = document.querySelector("#store-filters .store-filter-chip");
    if (!chip) return { ok: false, reason: "no store chip" };
    const radius = parseFloat(getComputedStyle(chip).borderRadius);
    if (!Number.isFinite(radius) || radius < 10) {
      return { ok: false, reason: "store chips should use tile radius like categories", radius };
    }
    return { ok: true };
  });
  if (!storeChipShape.ok) failures.push(`store chips: ${storeChipShape.reason ?? JSON.stringify(storeChipShape)}`);

  const storeChip = page.locator("#store-filters button.store-filter-chip[data-store]").nth(1);
  const storeName = await storeChip.getAttribute("data-store");
  if (!storeName || storeName === "Todas as lojas") {
    failures.push("expected a named store chip for filter feedback");
  } else {
    await storeChip.click();
    const feedback = await page.evaluate(() => {
      const badge = document.querySelector("#results-updated-badge");
      const title = document.querySelector("#results-title")?.textContent ?? "";
      return {
        badgeVisible: badge && !badge.hidden,
        badgeText: badge?.textContent?.trim() ?? "",
        title,
      };
    });
    if (!feedback.badgeVisible) failures.push("results updated badge should show after store filter");
    if (!feedback.badgeText.includes("atualiz")) failures.push(`badge copy should mention update (${feedback.badgeText})`);
    if (!feedback.title.includes(storeName)) failures.push(`results title should name store (${feedback.title})`);
    const scope = await page.evaluate(() => {
      const bar = document.querySelector("#results-scope-bar");
      const store = document.querySelector("#results-scope-store")?.textContent ?? "";
      return { visible: bar && !bar.hidden, store };
    });
    if (!scope.visible) failures.push("results scope bar should stay visible when a store is filtered");
    if (!scope.store.includes(storeName.split(" ")[0])) failures.push(`scope bar should name store (${scope.store})`);
  }

  const acougueChip = page.locator('#popular-items button[data-group="carnes"]');
  if (!(await acougueChip.count())) failures.push("Açougue (kg) category chip missing");
  else {
    const label = await acougueChip.locator("small").textContent();
    if (!label?.includes("Açougue")) failures.push("carnes chip should show Açougue (kg) label");
  }

  await page.waitForFunction(() => {
    const shell = document.querySelector("#alerts-invite-shell");
    return shell && !shell.hidden;
  }, null, { timeout: 15_000 }).catch(() => {
    failures.push("alerts invite shell should show for guests");
  });

  await acougueChip.first().click();
  await page.waitForSelector("#clear-active-filters:not([hidden])", { timeout: 5000 }).catch(() => {
    failures.push("Limpar filtros should appear when a category is active");
  });

  const listMode = await page.evaluate(() => document.querySelector("#offer-grid")?.classList.contains("list-view"));
  if (!listMode) failures.push("mobile default should use list view on offer grid");

  await page.locator("#clear-active-filters").click();
  const cleared = await page.locator("#clear-active-filters").evaluate((el) => el.hidden);
  if (!cleared) failures.push("Limpar filtros should hide after clearing");

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const listCardLayout = await page.evaluate(() => {
    const card = document.querySelector(".list-view .offer-card");
    if (!card) return { ok: false, reason: "no list card" };
    const hiddenNotice = card.querySelector(".offer-notice[hidden]");
    if (!hiddenNotice) return { ok: false, reason: "expected hidden offer-notice slot" };
    const noticeStyle = getComputedStyle(hiddenNotice);
    const noticeBox = hiddenNotice.getBoundingClientRect();
    if (noticeStyle.display !== "none" || noticeBox.height > 0.5) {
      return { ok: false, reason: "hidden offer-notice must not paint in list view", display: noticeStyle.display, height: noticeBox.height };
    }
    const title = card.querySelector(".card-title h3");
    const note = card.querySelector(".offer-note:not([hidden])");
    if (title && note) {
      const titleTop = title.getBoundingClientRect().top;
      const noteTop = note.getBoundingClientRect().top;
      if (noteTop < titleTop) return { ok: false, reason: "offer-note above title" };
    }
    const like = card.querySelector(".offer-reaction-button");
    const favorite = card.querySelector(".offer-reactions .favorite-toggle-reaction");
    if (!like || like.closest(".offer-reactions")?.hidden) {
      return { ok: false, reason: "like button should show in list view" };
    }
    if (!favorite || favorite.closest(".offer-reactions")?.hidden) {
      return { ok: false, reason: "favorite button should show in list view" };
    }
    const reactions = card.querySelector(".offer-reactions");
    if (!reactions || getComputedStyle(reactions).display === "none") {
      return { ok: false, reason: "offer-reactions must be visible on mobile list" };
    }
    return { ok: true };
  });
  if (!listCardLayout.ok) failures.push(`list card layout: ${listCardLayout.reason ?? JSON.stringify(listCardLayout)}`);

  const navChrome = await page.evaluate(() => {
    const nav = document.querySelector(".mobile-bottom-nav");
    if (!nav) return { ok: false, reason: "missing mobile bottom nav" };
    const style = getComputedStyle(nav);
    const radius = parseFloat(style.borderRadius);
    if (!Number.isFinite(radius) || radius < 12) return { ok: false, reason: "expected rounded floating nav", radius: style.borderRadius };
    return { ok: true };
  });
  if (!navChrome.ok) failures.push(`mobile nav: ${navChrome.reason ?? JSON.stringify(navChrome)}`);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("Mobile UX checks failed:");
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(`OK: mobile UX at ${BASE}/index.html`);
