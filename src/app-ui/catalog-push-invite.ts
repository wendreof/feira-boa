import { activateCatalogPushOnDevice, getPushSubscription, isPushConfigured } from "../push";
import { unregisterAnonymousCatalogPush } from "../catalog-push-register";
import { savePushSubscription } from "../account";
import { appState } from "./state";
import { pushFailureMessage } from "../../push-state.js";
import { errorMessage } from "../errors";

const DISMISS_KEY = "feira-boa-catalog-push-dismissed-at";
const REGISTERED_KEY = "feira-boa-catalog-push-registered";
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

const shell = document.querySelector<HTMLElement>("#catalog-push-invite-shell");
const panel = document.querySelector<HTMLButtonElement>("#catalog-push-invite");
const dismissButton = document.querySelector<HTMLButtonElement>("#catalog-push-dismiss");
const status = document.querySelector<HTMLElement>("#catalog-push-status");

function dismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

function markedRegistered(): boolean {
  try {
    return localStorage.getItem(REGISTERED_KEY) === "1";
  } catch {
    return false;
  }
}

function markRegistered(): void {
  try {
    localStorage.setItem(REGISTERED_KEY, "1");
  } catch {
    // ignore
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

async function deviceAlreadyRegistered(): Promise<boolean> {
  if (!markedRegistered() || Notification.permission !== "granted") return false;
  const subscription = await getPushSubscription();
  return Boolean(subscription);
}

export async function refreshCatalogPushInvite(): Promise<void> {
  if (!shell || !panel) return;
  if (!isPushConfigured() || !("Notification" in window) || !("serviceWorker" in navigator)) {
    shell.hidden = true;
    return;
  }
  if (Notification.permission === "denied" || dismissedRecently()) {
    shell.hidden = true;
    return;
  }
  if (await deviceAlreadyRegistered()) {
    shell.hidden = true;
    return;
  }
  shell.hidden = false;
}

async function runCatalogPushActivation(): Promise<void> {
  if (!panel || panel.disabled) return;
  panel.disabled = true;
  if (status) {
    status.hidden = false;
    status.textContent = "Solicitando permissão…";
  }
  try {
    const subscription = await activateCatalogPushOnDevice();
    if (appState.currentUserId) {
      await unregisterAnonymousCatalogPush(subscription);
      await savePushSubscription(appState.currentUserId, subscription);
    }
    markRegistered();
    if (shell) shell.hidden = true;
  } catch (error) {
    if (status) {
      status.textContent = pushFailureMessage(error) || errorMessage(error);
    }
    await refreshCatalogPushInvite();
  } finally {
    panel.disabled = Notification.permission === "denied";
  }
}

export function bindCatalogPushInvite(): void {
  dismissButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    markDismissed();
    if (shell) shell.hidden = true;
  });

  panel?.addEventListener("click", () => {
    void runCatalogPushActivation();
  });
}
