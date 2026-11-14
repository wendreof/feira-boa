/**
 * Playwright: catalog push invite — whole panel activates push (not only CTA pill).
 * Run: npm run build && node scripts/test-catalog-push-invite-playwright.mjs
 */
import { chromium } from "playwright";
import { SITE_URL, ensureStaticServer, waitForServer } from "./test/playwright-harness.mjs";

const BASE = SITE_URL;

const serverNote = await ensureStaticServer("/index.html");
if (serverNote === "started") await waitForServer(`${BASE}/index.html`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
await context.grantPermissions(["notifications"], { origin: BASE });
await context.route("**/rest/v1/rpc/register_anonymous_push_subscription", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "null",
  });
});

const page = await context.newPage();
const failures = [];

await page.addInitScript(() => {
  try {
    localStorage.removeItem("feira-boa-catalog-push-dismissed-at");
    localStorage.removeItem("feira-boa-catalog-push-registered");
    for (const key of Object.keys(localStorage)) {
      if (/^sb-.*-auth-token$/.test(key)) localStorage.removeItem(key);
    }
  } catch {
  // ignore
  }

  const mockSubscription = {
    endpoint: "https://push.test/feira-boa",
    toJSON() {
      return {
        endpoint: this.endpoint,
        keys: { p256dh: "dGVzdC1wMjU2ZGg", auth: "dGVzdC1hdXRo" },
      };
    },
    unsubscribe() {
      return Promise.resolve(true);
    },
  };

  const pushManager = {
    getSubscription: () => Promise.resolve(null),
    subscribe: () => Promise.resolve(mockSubscription),
  };

  const registration = {
    pushManager,
    update: () => Promise.resolve(),
    waiting: null,
  };

  if (!("serviceWorker" in navigator)) {
    Object.defineProperty(navigator, "serviceWorker", { value: {}, configurable: true });
  }

  navigator.serviceWorker.getRegistration = () => Promise.resolve(null);
  navigator.serviceWorker.register = () => Promise.resolve(registration);
  Object.defineProperty(navigator.serviceWorker, "ready", {
    get: () => Promise.resolve(registration),
    configurable: true,
  });

  try {
    Object.defineProperty(Notification, "permission", {
      get: () => "default",
      configurable: true,
    });
  } catch {
    // Chromium headless may still report denied; requestPermission override below is the source of truth.
  }

  Notification.requestPermission = () => Promise.resolve("granted");
});

try {
  await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const cancel = page.locator("#login-gate-cancel");
  if (await cancel.isVisible({ timeout: 4000 }).catch(() => false)) await cancel.click();

  await page.waitForFunction(
    () => {
      const shell = document.querySelector("#catalog-push-invite-shell");
      return shell && !shell.hidden;
    },
    null,
    { timeout: 20_000 },
  );

  const panel = page.locator("#catalog-push-invite");
  const nestedCta = panel.locator("#catalog-push-activate");
  if (await panel.evaluate((el) => el.tagName) !== "BUTTON") {
    failures.push("catalog push panel should be a single button");
  }
  if (await nestedCta.evaluate((el) => el.tagName) !== "SPAN") {
    failures.push("catalog push CTA should be a decorative span inside the panel button");
  }

  await page.locator("#catalog-push-heading").click({ position: { x: 4, y: 4 } });

  await page.waitForFunction(
    () => {
      const shell = document.querySelector("#catalog-push-invite-shell");
      return shell?.hidden || localStorage.getItem("feira-boa-catalog-push-registered") === "1";
    },
    null,
    { timeout: 15_000 },
  );

  const outcome = await page.evaluate(() => ({
    shellHidden: document.querySelector("#catalog-push-invite-shell")?.hidden ?? false,
    registered: localStorage.getItem("feira-boa-catalog-push-registered"),
  }));

  if (!outcome.shellHidden) failures.push("catalog push shell should hide after successful activation");
  if (outcome.registered !== "1") failures.push("catalog push should mark local registration after enable");
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("Catalog push invite UI test failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Catalog push invite UI test passed.");
