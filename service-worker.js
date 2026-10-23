const CACHE_NAME = "feira-boa-shell-v7";
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(self.location.hostname);

// OneSignal owns push display, click handling and subscription renewal.
try {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.worker.js");
} catch (error) {
  // Offline or blocked CDN: caching still works; push needs the next load.
  console.warn("OneSignal worker script unavailable.", error);
}

const SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/styles.css",
  "/theme.css",
  "/theme-bootstrap.js",
  "/app.js",
  "/navigation.js",
  "/pwa.js",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/offers.json",
  "/source-status.js",
];
const NETWORK_FIRST = ["/offers.json", "/source-status.js", "/build-info.json"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    if (IS_LOCAL) {
      // Em desenvolvimento não guardamos nada: o preview precisa refletir o build atual.
      // O worker fica registrado para permitir testar notificações push em localhost.
      await self.skipWaiting();
      return;
    }
    const cache = await caches.open(await shellCacheName());
    await Promise.allSettled(SHELL.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    if (IS_LOCAL) {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.clients.claim();
      return;
    }
    const current = await shellCacheName();
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== current).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

/** O shell é versionado pelo build para que um deploy novo invalide o cache antigo. */
async function shellCacheName() {
  try {
    const response = await fetch("/build-info.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Build info unavailable");
    const build = await response.json();
    const stamp = build.commit && build.commit !== "local" ? build.commit : String(build.builtAt ?? "").slice(0, 10);
    return `${CACHE_NAME}-${stamp}`;
  } catch {
    return CACHE_NAME;
  }
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (fallbackUrl ? cache.match(fallbackUrl) : undefined) ?? Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => undefined);
  return cached ?? (await network) ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (IS_LOCAL) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/offline.html"));
    return;
  }
  if (NETWORK_FIRST.includes(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

// Push display, notification clicks and subscription renewal are handled by
// the OneSignal worker imported above; do not add custom push listeners here.
