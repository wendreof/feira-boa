/**
 * Mobile: categories, store logos, scroll strips, clear filters, list view.
 */
import { chromium } from "playwright";
import { SITE_URL, dismissLoginGate, ensureStaticServer, waitForServer } from "./test/playwright-harness.mjs";

const BASE = SITE_URL;

const serverNote = await ensureStaticServer("/index.html");
if (serverNote === "started") await waitForServer(`${BASE}/index.html`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const failures = [];

try {
  await page.route("**/offers.json", async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const feedLoading = await page.evaluate(() => {
    const grid = document.querySelector("#offer-grid");
    return {
      loadingClass: grid?.classList.contains("offer-grid--loading") ?? false,
      skeletons: document.querySelectorAll("#offer-grid .offer-skeleton").length,
      busy: grid?.getAttribute("aria-busy") === "true",
    };
  });
  if (!feedLoading.loadingClass || feedLoading.skeletons < 4) {
    failures.push(`offer grid should show skeleton while feed loads (loading=${feedLoading.loadingClass}, skeletons=${feedLoading.skeletons})`);
  }
  if (!feedLoading.busy) failures.push("offer grid should be aria-busy while feed loads");
  await page.waitForSelector("#offer-grid .offer-card", { timeout: 45_000 });
  await page.unroute("**/offers.json");
  const feedReady = await page.evaluate(() => ({
    loading: document.querySelector("#offer-grid")?.classList.contains("offer-grid--loading"),
    skeletons: document.querySelectorAll("#offer-grid .offer-skeleton").length,
    cards: document.querySelectorAll("#offer-grid .offer-card").length,
  }));
  if (feedReady.loading || feedReady.skeletons > 0) {
    failures.push("offer grid skeleton should clear after feed renders");
  }
  if (feedReady.cards < 1) failures.push("expected offer cards after feed load");
  await dismissLoginGate(page);

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
    await storeChip.scrollIntoViewIfNeeded();
    await storeChip.click();
    await page.waitForFunction(
      (name) => {
        const title = document.querySelector("#results-title")?.textContent ?? "";
        return title.includes(name);
      },
      storeName,
      { timeout: 10_000 },
    ).catch(() => {
      failures.push(`results title did not update after store filter (${storeName})`);
    });
    const feedback = await page.evaluate(() => {
      const badge = document.querySelector("#results-updated-badge");
      const title = document.querySelector("#results-title")?.textContent ?? "";
      return {
        badgeVisible: badge && !badge.hidden,
        badgeText: badge?.textContent?.trim() ?? "",
        title,
      };
    });
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

  await acougueChip.first().click();
  const categoryToggledOff = await page.evaluate(() => {
    const chip = document.querySelector('#popular-items button[data-group="carnes"]');
    return Boolean(chip && !chip.classList.contains("active") && chip.getAttribute("aria-pressed") === "false");
  });
  if (!categoryToggledOff) failures.push("active category chip should clear when clicked again");

  const listMode = await page.evaluate(() => document.querySelector("#offer-grid")?.classList.contains("list-view"));
  if (!listMode) failures.push("mobile default should use list view on offer grid");

  await page.locator("#clear-active-filters").evaluate((el) => el.click());
  await page.waitForFunction(
    () => {
      const activeStore = document.querySelector("#store-filters .store-filter-chip.active")?.getAttribute("data-store");
      const activeGroup = document.querySelector("#popular-items button.active")?.getAttribute("data-group");
      const search = document.querySelector("#search-input")?.value?.trim() ?? "";
      return activeStore === "Todas as lojas" && !activeGroup && !search;
    },
    null,
    { timeout: 10_000 },
  ).catch(() => {
    failures.push("Limpar filtros should reset store, category and search");
  });

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
