const DEFAULT_TITLE = "Feira Boa · alerta de preço";

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

  event.waitUntil(self.registration.showNotification(payload.title ?? DEFAULT_TITLE, {
    body: payload.body ?? "Uma oferta combina com seu alerta.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
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
