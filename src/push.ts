import { VAPID_PUBLIC_KEY } from "./vapid-config";
import { savePushSubscription } from "./account";
import { registerAnonymousCatalogPush, unregisterAnonymousCatalogPush } from "./catalog-push-register";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Url);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

let registrationTask: Promise<ServiceWorkerRegistration> | null = null;

export function isPushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0;
}

function resetRegistrationTask(): void {
  registrationTask = null;
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Este navegador não suporta notificações push.");
  }
  if (!registrationTask) {
    registrationTask = (async () => {
      let registration = await navigator.serviceWorker.getRegistration("/");
      if (!registration) {
        registration = await navigator.serviceWorker.register("/service-worker.js", {
          scope: "/",
          updateViaCache: "none",
        });
      }
      await navigator.serviceWorker.ready;
      return registration;
    })().catch((error) => {
      resetRegistrationTask();
      throw error;
    });
  }
  return registrationTask;
}

/** Pulls a waiting service worker live (needed after deploy on desktop). */
export async function syncPushServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  resetRegistrationTask();
  try {
    const registration = await ensureServiceWorkerRegistration();
    await registration.update();
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  } catch (error) {
    console.warn("Could not refresh the service worker for push.", error);
  }
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    return await ensureServiceWorkerRegistration();
  } catch {
    return null;
  }
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

async function subscribeWithVapid(registration: ServiceWorkerRegistration): Promise<PushSubscription> {
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  });
}

export async function subscribeToPush(): Promise<PushSubscription> {
  if (!isPushConfigured()) {
    throw new Error("Notificações do navegador ainda não estão disponíveis neste site.");
  }
  await syncPushServiceWorker();
  const registration = await ensureServiceWorkerRegistration();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(permission === "denied" ? "Permissão bloqueada no navegador." : "Permissão não concedida.");
  }

  const stale = await registration.pushManager.getSubscription();
  if (stale) await stale.unsubscribe().catch(() => undefined);

  try {
    return await subscribeWithVapid(registration);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/push service error|invalid key|registration failed/i.test(message)) {
      await registration.pushManager.getSubscription()
        .then((sub) => sub?.unsubscribe())
        .catch(() => undefined);
      return subscribeWithVapid(registration);
    }
    throw error;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getPushSubscription();
  if (subscription) await subscription.unsubscribe();
}

/** Re-salva a inscrição deste navegador quando o usuário já concedeu permissão. */
export async function linkPushDeviceToUser(userId: string): Promise<void> {
  try {
    if (!isPushConfigured() || Notification.permission !== "granted") return;
    const subscription = await getPushSubscription();
    if (!subscription) return;
    await unregisterAnonymousCatalogPush(subscription);
    await savePushSubscription(userId, subscription);
  } catch (error) {
    console.warn("Could not sync push subscription with the account.", error);
  }
}

/** Permissão no navegador + inscrição local; conta opcional (catálogo diário). */
export async function activateCatalogPushOnDevice(): Promise<PushSubscription> {
  const subscription = await subscribeToPush();
  await registerAnonymousCatalogPush(subscription);
  return subscription;
}
