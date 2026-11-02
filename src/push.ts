import { VAPID_PUBLIC_KEY } from "./vapid-config";
import { savePushSubscription } from "./account";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Url);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function isPushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0;
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<PushSubscription> {
  if (!isPushConfigured()) {
    throw new Error("Notificações do navegador ainda não estão disponíveis neste site.");
  }
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    throw new Error("Este navegador não suporta notificações push.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(permission === "denied" ? "Permissão bloqueada no navegador." : "Permissão não concedida.");
  }
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }
  return subscription;
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
    await savePushSubscription(userId, subscription);
  } catch (error) {
    console.warn("Could not sync push subscription with the account.", error);
  }
}
