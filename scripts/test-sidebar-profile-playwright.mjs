/**
 * The account entry is the profile card at the top of every sidebar.
 * Run: node scripts/test-sidebar-profile-playwright.mjs
 */
import { chromium } from "playwright";
import { SITE_URL, dismissLoginGate, ensureStaticServer, waitForServer } from "./test/playwright-harness.mjs";

const serverNote = await ensureStaticServer("/lojas.html");
if (serverNote === "started") await waitForServer(`${SITE_URL}/lojas.html`);

const browser = await chromium.launch({ headless: true });
const failures = [];

const session = JSON.stringify({
  access_token: "sidebar-profile-test",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: "user-sidebar",
    user_metadata: { full_name: "Wendreo Fernandes" },
  },
});

try {
  const guest = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await guest.goto(`${SITE_URL}/lojas.html`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await dismissLoginGate(guest);
  const guestFirst = guest.locator("#app-sidebar .sidebar-nav > a").first();
  if (await guestFirst.getAttribute("id") !== "nav-account") failures.push("guest profile is not the first sidebar item");
  if (!(await guestFirst.getAttribute("class"))?.includes("sidebar-profile")) failures.push("guest account entry is not the profile card");
  if ((await guest.locator("[data-account-label]").innerText()).trim() !== "Entrar") failures.push("guest label is not Entrar");
  if (await guest.locator("#sidebar-profile-name").isVisible()) failures.push("guest name is visible");
  const guestLabels = await guest.locator("#app-sidebar .sidebar-nav > a").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
  const expectedGuest = ["Entrar", "Ofertas", "Lojas", "Favoritos", "Alertas de preço", "Notificações", "Enviar sugestão"];
  if (guestLabels.join("|") !== expectedGuest.join("|")) failures.push(`guest order ${guestLabels.join(" > ")}`);
  await guest.close();

  const signedIn = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await signedIn.addInitScript((storedSession) => {
    localStorage.setItem("sb-muiuvmhzzbqflxznpnez-auth-token", storedSession);
  }, session);
  await signedIn.goto(`${SITE_URL}/lojas.html`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await dismissLoginGate(signedIn);
  const profile = signedIn.locator("#nav-account");
  if ((await profile.getAttribute("href")) !== "account.html") failures.push(`signed-in href ${await profile.getAttribute("href")}`);
  if ((await profile.getAttribute("aria-label")) !== "Minha conta") failures.push("signed-in aria-label");
  if ((await signedIn.locator("[data-account-label]").innerText()).trim() !== "Minha conta") failures.push("signed-in subtitle");
  if ((await signedIn.locator("#sidebar-profile-name").innerText()).trim() !== "Wendreo Fernandes") failures.push("signed-in name missing");
  if (await signedIn.locator("#nav-account").count() !== 1) failures.push("duplicate account entry");
  await signedIn.close();

  const stableSrc = `${SITE_URL}/icons/icon-192.png`;
  const signedNav = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const oauthSession = JSON.stringify({
    access_token: "sidebar-profile-test",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: "user-sidebar",
      app_metadata: { provider: "google" },
      user_metadata: {
        full_name: "Wendreo Fernandes",
        picture: stableSrc,
      },
    },
  });
  await signedNav.addInitScript(({ storedSession, stableSrc: avatarSrc }) => {
    localStorage.setItem("sb-muiuvmhzzbqflxznpnez-auth-token", storedSession);
    sessionStorage.setItem(
      "feira-boa:avatar-path:v1",
      JSON.stringify({ userId: "user-sidebar", path: null }),
    );
    sessionStorage.setItem(
      "feira-boa:sidebar-avatar-src:v1",
      JSON.stringify({ userId: "user-sidebar", src: avatarSrc }),
    );
  }, { storedSession: oauthSession, stableSrc });
  await signedNav.goto(`${SITE_URL}/lojas.html`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await dismissLoginGate(signedNav);
  await signedNav.waitForFunction((expected) => {
    const img = document.querySelector("#topbar-account-image");
    return img instanceof HTMLImageElement && !img.hidden && img.getAttribute("src") === expected;
  }, stableSrc, { timeout: 10_000 });
  const srcLojas = await signedNav.locator("#topbar-account-image").getAttribute("src");
  await signedNav.goto(`${SITE_URL}/suggestions.html`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await dismissLoginGate(signedNav);
  await signedNav.waitForFunction((expected) => {
    const img = document.querySelector("#topbar-account-image");
    return img instanceof HTMLImageElement && !img.hidden && img.getAttribute("src") === expected;
  }, stableSrc, { timeout: 10_000 });
  const srcSuggestions = await signedNav.locator("#topbar-account-image").getAttribute("src");
  if (srcLojas !== stableSrc) failures.push(`lojas avatar src ${srcLojas}`);
  if (srcSuggestions !== stableSrc) failures.push(`suggestions avatar src ${srcSuggestions}`);
  if (srcLojas !== srcSuggestions) failures.push("avatar src changed across lojas -> suggestions");
  await signedNav.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("Sidebar profile checks failed:");
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(`OK: sidebar profile card on lojas (guest and signed-in) at ${SITE_URL}`);
if (serverNote === "started") console.log("(Started embedded static server on 8790 for this run.)");
