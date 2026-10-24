import { pushFailureMessage, resolvePushUiState } from "../../push-state.js";
import { requireOneSignal } from "../push";
import { errorMessage } from "../errors";
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
    const oneSignal = await requireOneSignal();
    accountState.devicePushEnabled = oneSignal.User.PushSubscription.optedIn === true;
  } catch {
    accountState.devicePushEnabled = false;
  }
  accountState.accountPushEnabled = false;
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
export async function detachOneSignalFromAccount(): Promise<void> {
  try {
    const oneSignal = await requireOneSignal();
    await oneSignal.logout();
  } catch (error) {
    console.warn("Could not detach OneSignal from the account.", error);
  }
}

async function activatePush(button: HTMLButtonElement): Promise<void> {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    setPushFeedback("Este navegador não oferece suporte a notificações push.");
    return;
  }
  const approved = window.confirm("A Feira Boa poderá enviar alertas de preço que você criou, com produto, loja, preço e validade da oferta. Deseja ativar notificações neste dispositivo?");
  if (!approved) return;

  button.disabled = true;
  setPushFeedback();
  if (pushStatus) pushStatus.textContent = "Solicitando permissão…";
  try {
    const oneSignal = await requireOneSignal();
    const permission = Notification.permission === "default"
      ? await oneSignal.Notifications.requestPermission()
      : Notification.permission === "granted";
    if (!permission) {
      throw new Error(Notification.permission === "denied" ? "Permissão bloqueada no navegador." : "Permissão não concedida.");
    }
    if (accountState.userId) await oneSignal.login(accountState.userId);
    if (oneSignal.User.PushSubscription.optedIn !== true) {
      await oneSignal.User.PushSubscription.optIn();
    }
    accountState.devicePushEnabled = oneSignal.User.PushSubscription.optedIn === true;
    if (!accountState.devicePushEnabled) throw new Error("O navegador não ativou as notificações. Tente novamente.");
    setPushFeedback();
    updatePushControls();
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
    const oneSignal = await requireOneSignal();
    if (oneSignal.User.PushSubscription.optedIn === true) {
      await oneSignal.User.PushSubscription.optOut();
    }
    accountState.devicePushEnabled = false;
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
