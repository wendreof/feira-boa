const CACHE_NAME = "feira-boa-shell-v7";
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(self.location.hostname);
const VAPID_PUBLIC_KEY = "BLFV8pgkW21YRHFS_q-8tm5X6YZBghDNTrxUyvOEhJYSc9QmVXjbEStxd_R-7ndf5B4NrUcIdpcvTtS-OAfreyg";
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

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() ?? "Uma oferta combina com seu alerta." };
  }

  const destination = new URL(payload.url ?? "./index.html", self.location.origin);
  const safeUrl = destination.origin === self.location.origin
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : "/index.html";

  event.waitUntil(self.registration.showNotification(payload.title ?? "Feira Boa · alerta de preço", {
    body: payload.body ?? "Uma oferta combina com seu alerta.",
    icon: "/icons/notification-96.png",
    badge: "/icons/badge-72.png",
    tag: payload.tag ?? "feira-boa-offer",
    data: { url: safeUrl },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url ?? "/index.html", self.location.origin);
  const safeUrl = destination.origin === self.location.origin ? destination.href : `${self.location.origin}/index.html`;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(safeUrl);
      return existing.focus();
    }
    return self.clients.openWindow(safeUrl);
  }));
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    const oldEndpoint = event.oldSubscription?.endpoint;
    try {
      const normalized = VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/");
      const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
      const keyBytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) keyBytes[index] = binary.charCodeAt(index);
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes,
      });
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        client.postMessage({
          type: "push-subscription-changed",
          oldEndpoint,
          subscription: subscription.toJSON(),
        });
      }
      if (windows.length === 0) {
        await self.registration.showNotification("Feira Boa · notificações renovadas", {
          body: "Abra sua conta para confirmar o novo dispositivo de alertas.",
          icon: "/icons/notification-96.png",
          badge: "/icons/badge-72.png",
          data: { url: "/account-alerts.html" },
        });
      }
    } catch (error) {
      console.warn("Could not renew push subscription.", error);
    }
  })());
});
