import { readFile, stat } from "node:fs/promises";

const requiredFiles = [
  "index.html",
  "lojas.html",
  "login.html",
  "account.html",
  "alerts.html",
  "account-favorites.html",
  "account-stores.html",
  "admin.html",
  "suggestions.html",
  "termos.html",
  "onesignal/OneSignalSDK.page.es6.js",
  "onesignal/OneSignalSDKWorker.js",
  "offline.html",
  "styles.css",
  "theme.css",
  "theme-bootstrap.js",
  "navigation.js",
  "pwa.js",
  "site-version.js",
  "source-status.js",
  "app.js",
  "stores.js",
  "login.js",
  "account.js",
  "suggestions.js",
  "admin.js",
  "alerts.js",
  "offers.json",
  "build-info.json",
  "service-worker.js",
  "manifest.webmanifest",
  "offers-jsonld.js",
  "_headers",
  "favicon.svg",
  "social-card.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/notification-96.png",
  "icons/badge-72.png",
];

const failures = [];
for (const file of requiredFiles) {
  try {
    const info = await stat(new URL(`../${file}`, import.meta.url));
    if (!info.isFile() || info.size === 0) failures.push(`${file}: empty or not a file`);
  } catch {
    failures.push(`${file}: missing`);
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), "utf8"));
  } catch (error) {
    failures.push(`${file}: ${error.message}`);
    return null;
  }
}

const feed = await readJson("offers.json");
if (feed && (feed.schemaVersion !== 1 || !Array.isArray(feed.offers) || !Array.isArray(feed.stores) || feed.offers.length === 0)) {
  failures.push("offers.json: invalid shape");
}
const buildInfo = await readJson("build-info.json");
if (buildInfo && (!buildInfo.commit || !buildInfo.version || !Number.isFinite(Date.parse(buildInfo.builtAt)))) {
  failures.push("build-info.json: invalid shape");
}
const manifest = await readJson("manifest.webmanifest");
if (manifest) {
  const sizes = new Set((manifest.icons ?? []).map((icon) => icon.sizes));
  if (!sizes.has("192x192") || !sizes.has("512x512")) failures.push("manifest.webmanifest: missing icon sizes");
}

for (const file of ["index.html", "lojas.html", "login.html", "account.html", "suggestions.html", "termos.html", "admin.html"]) {
  try {
    const html = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    if (!html.includes('src="theme-bootstrap.js"')) failures.push(`${file}: missing theme bootstrap`);
    if (!html.includes('src="pwa.js"')) failures.push(`${file}: missing PWA registration`);
    if (html.includes("document.documentElement.dataset.theme")) failures.push(`${file}: contains inline theme script`);
    if (/\son(?:click|load|error|change)\s*=/i.test(html)) failures.push(`${file}: contains an inline event handler`);
  } catch {
    // Missing file already reported.
  }
}

try {
  const worker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
  if (!worker.includes('addEventListener("fetch"')) failures.push("service-worker.js: missing fetch handler");
  if (!worker.includes('addEventListener("push"') && !worker.includes("OneSignalSDK")) {
    failures.push("service-worker.js: missing push handler or OneSignal worker");
  }
} catch {
  // Missing file already reported.
}

if (failures.length > 0) {
  console.error("Root artifact verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Verified ${requiredFiles.length} root artifacts.`);
