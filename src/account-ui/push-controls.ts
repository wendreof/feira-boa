import { isDevicePushEnabled, pushFailureMessage, resolvePushUiState } from "../../push-state.js";
import { hasPushSubscriptions, removePushSubscription, savePushSubscription } from "../account";
import { errorMessage } from "../errors";
import {
  getPushSubscription,
  isPushConfigured,
  subscribeToPush,
  unsubscribeFromPush,
} from "../push";
import { accountState } from "./state";
import { setPushFeedback } from "./ui";
import {
  disablePushButton,
  enablePushButton,
  pushContext,
  pushHelp,
  pushStatus,
} from "./dom";

export async function refreshPushDeviceState(): Promise<void> {
  try {
    if (!isPushConfigured()) {
      accountState.devicePushEnabled = false;
    } else {
      const subscription = await getPushSubscription();
      const browserAllows = "Notification" in window && Notification.permission === "granted";
      accountState.devicePushEnabled = Boolean(subscription) && browserAllows;
    }
  } catch {
    accountState.devicePushEnabled = false;
  }
  updatePushControls();
}

export function updatePushControls(): void {
  if (!pushStatus || !enablePushButton || !disablePushButton) return;
  const permissionDenied = "Notification" in window && Notification.permission === "denied";
  const state = resolvePushUiState({
    deviceEnabled: accountState.devicePushEnabled,
    accountEnabled: accountState.accountPushEnabled,
    permissionDenied,
  });
  pushStatus.textContent = state.status;
  enablePushButton.textContent = state.enableLabel;
  enablePushButton.hidden = !state.showEnable;
  enablePushButton.disabled = state.disableEnable;
  disablePushButton.hidden = !state.showDisable;
  if (pushHelp) pushHelp.hidden = !state.showPermissionHelp;
  if (pushContext) pushContext.hidden = !state.showAccountContext;
}

/** Desvincula o dispositivo da conta antes de sair ou excluir a conta. */
export async function detachPushFromAccount(): Promise<void> {
  try {
    const subscription = await getPushSubscription();
    if (accountState.userId && subscription?.endpoint) {
      await removePushSubscription(accountState.userId, subscription.endpoint);
    }
    await unsubscribeFromPush();
  } catch (error) {
    console.warn("Could not detach push from the account.", error);
  }
}

async function rememberPushSubscription(): Promise<void> {
  if (!accountState.userId) return;
  try {
    const subscription = await getPushSubscription();
    if (subscription) await savePushSubscription(accountState.userId, subscription);
    accountState.accountPushEnabled = await hasPushSubscriptions(accountState.userId);
  } catch (error) {
    console.warn("Could not save the push subscription for this account.", error);
  }
}

async function forgetPushSubscription(subscription: PushSubscription | null): Promise<void> {
  if (!accountState.userId || !subscription?.endpoint) return;
  try {
    await removePushSubscription(accountState.userId, subscription.endpoint);
    accountState.accountPushEnabled = await hasPushSubscriptions(accountState.userId);
  } catch (error) {
    console.warn("Could not remove the saved push subscription.", error);
  }
}

async function activatePush(button: HTMLButtonElement): Promise<void> {
  if (!isPushConfigured() || !("serviceWorker" in navigator) || !("Notification" in window)) {
    setPushFeedback("Este navegador não oferece suporte a notificações push.");
    return;
  }
  const approved = window.confirm("A Feira Boa poderá enviar alertas de preço que você criou, com produto, loja, preço e validade da oferta. Deseja ativar notificações neste dispositivo?");
  if (!approved) return;

  button.disabled = true;
  setPushFeedback();
  if (pushStatus) pushStatus.textContent = "Solicitando permissão…";
  try {
    await subscribeToPush();
    accountState.devicePushEnabled = isDevicePushEnabled({
      permission: Notification.permission,
      optedIn: true,
      activatedNow: true,
    });
    if (!accountState.devicePushEnabled) throw new Error("O navegador não ativou as notificações. Tente novamente.");
    setPushFeedback();
    updatePushControls();
    await rememberPushSubscription();
  } catch (error) {
    console.error("Could not activate push notifications.", error);
    setPushFeedback(pushFailureMessage(error));
    await refreshPushDeviceState();
  } finally {
    button.disabled = Notification.permission === "denied";
  }
}

async function deactivatePush(button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  setPushFeedback();
  if (pushStatus) pushStatus.textContent = "Desativando neste dispositivo…";
  try {
    const subscription = await getPushSubscription();
    await unsubscribeFromPush();
    accountState.devicePushEnabled = false;
    await forgetPushSubscription(subscription);
    setPushFeedback("Notificações desativadas neste dispositivo.");
    updatePushControls();
  } catch (error) {
    console.error("Could not deactivate push notifications.", error);
    setPushFeedback(`Não foi possível desativar notificações: ${errorMessage(error)}`);
    await refreshPushDeviceState();
  } finally {
    button.disabled = false;
  }
}

export function bindPushControls(): void {
  const enableButton = enablePushButton;
  const disableButton = disablePushButton;
  if (enableButton) enableButton.addEventListener("click", () => activatePush(enableButton));
  if (disableButton) disableButton.addEventListener("click", () => deactivatePush(disableButton));
}
