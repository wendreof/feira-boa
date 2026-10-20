import {
  createAlertRule,
  deleteAccount,
  errorMessage,
  getCurrentUser,
  loadAccountSettings,
  removeAlertRule,
  removePushSubscription,
  savePreferences,
  savePushSubscription,
  setNotificationsPaused,
  signOut,
  type AlertRule,
} from "./account";
import type { OfferFeed, ProfilePreferences } from "./types";
import { vapidPublicKey } from "./supabase-config";
import { applyTheme, bindThemeToggle, type ThemePreference } from "./theme";

const email = document.querySelector<HTMLElement>("#account-email")!;
const status = document.querySelector<HTMLParagraphElement>("#account-status")!;
const signOutButton = document.querySelector<HTMLButtonElement>("#sign-out")!;
const deleteAccountButton = document.querySelector<HTMLButtonElement>("#delete-account")!;
const favoritesForm = document.querySelector<HTMLFormElement>("#favorite-preferences");
const alertForm = document.querySelector<HTMLFormElement>("#alert-rule-form");
const favoriteStores = document.querySelector<HTMLFieldSetElement>("#favorite-stores");
const favoriteProductTypes = document.querySelector<HTMLFieldSetElement>("#favorite-product-types");
const alertStore = document.querySelector<HTMLSelectElement>("#alert-store");
const alertProduct = document.querySelector<HTMLSelectElement>("#alert-product");
const targetPrice = document.querySelector<HTMLInputElement>("#target-price");
const alertRulesList = document.querySelector<HTMLUListElement>("#alert-rules");
const notificationsPaused = document.querySelector<HTMLInputElement>("#notifications-paused");
const pushStatus = document.querySelector<HTMLElement>("#push-status");
const pushHelp = document.querySelector<HTMLElement>("#push-help");
const enablePushButton = document.querySelector<HTMLButtonElement>("#enable-push");
const disablePushButton = document.querySelector<HTMLButtonElement>("#disable-push");

let userId = "";
let preferences: ProfilePreferences;
let rules: AlertRule[] = [];
let preferencesLoaded = false;
let pendingTheme: ThemePreference | null = null;

bindThemeToggle((theme) => {
  pendingTheme = theme;
  if (preferences) preferences.theme = theme;
  if (userId && preferencesLoaded) void saveThemePreference(theme);
});

async function saveThemePreference(theme: ThemePreference): Promise<void> {
  try {
    await savePreferences(userId, preferences);
    pendingTheme = null;
    setStatus("Tema salvo nas preferências da sua conta.");
  } catch (error) {
    setStatus(`Tema aplicado neste dispositivo. Não foi possível sincronizar: ${errorMessage(error)}`);
  }
}

function decodeApplicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function updatePushControls(isEnabled: boolean, enabledElsewhere = false): void {
  if (!pushStatus || !enablePushButton || !disablePushButton) return;
  const permissionDenied = "Notification" in window && Notification.permission === "denied";
  pushStatus.textContent = isEnabled
    ? "Ativado neste dispositivo"
    : permissionDenied
      ? "Bloqueado nas permissões do navegador"
      : enabledElsewhere
        ? "Ativado em outro dispositivo"
        : "Ainda não ativado";
  enablePushButton.hidden = isEnabled;
  enablePushButton.disabled = permissionDenied;
  disablePushButton.hidden = !isEnabled;
  if (pushHelp) pushHelp.hidden = !permissionDenied;
}

function setStatus(message: string): void {
  status.textContent = message;
}

function setActionsDisabled(disabled: boolean): void {
  signOutButton.disabled = disabled;
  deleteAccountButton.disabled = disabled;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; oldEndpoint?: string } | null;
    if (data?.type !== "push-subscription-changed" || !userId) return;
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) return;
        await savePushSubscription(userId, subscription);
        if (data.oldEndpoint && data.oldEndpoint !== subscription.endpoint) {
          await removePushSubscription(userId, data.oldEndpoint);
        }
        updatePushControls(true);
        setStatus("Notificações renovadas neste dispositivo.");
      } catch (error) {
        console.warn("Could not renew push subscription for the account.", error);
      }
    })();
  });
}

function makeOption(label: string, value: string): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function renderCheckboxes(container: HTMLFieldSetElement | null, values: string[], selected: string[]): void {
  if (!container) return;
  container.replaceChildren();
  for (const value of values) {
    const label = document.createElement("label");
    label.className = "preference-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = value;
    input.checked = selected.includes(value);
    const text = document.createElement("span");
    text.textContent = value;
    label.append(input, text);
    container.append(label);
  }
}

function checkedValues(container: HTMLFieldSetElement | null): string[] {
  return container ? Array.from(container.querySelectorAll<HTMLInputElement>("input:checked"), (input) => input.value) : [];
}

function renderRules(): void {
  if (!alertRulesList) return;
  alertRulesList.replaceChildren();
  for (const rule of rules) {
    const item = document.createElement("li");
    item.className = "alert-rule-item";
    const description = document.createElement("span");
    description.textContent = `${rule.product_type ?? rule.product ?? "Produto"} · ${rule.store ?? "Qualquer loja"} · até R$ ${rule.target_price.toFixed(2).replace(".", ",")}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button remove-rule";
    remove.dataset.ruleId = rule.id;
    remove.textContent = "Remover";
    remove.setAttribute("aria-label", `Remover alerta para ${rule.product_type ?? rule.product ?? "produto"}`);
    item.append(description, remove);
    alertRulesList.append(item);
  }
  if (rules.length === 0) {
    const empty = document.createElement("li");
    empty.className = "preference-empty";
    empty.textContent = "Você ainda não criou alertas de preço.";
    alertRulesList.append(empty);
  }
}

async function refreshRules(): Promise<void> {
  if (!alertRulesList) return;
  const settings = await loadAccountSettings(userId);
  rules = settings.alertRules;
  renderRules();
}

async function removeCurrentPushSubscription(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  if (userId) await removePushSubscription(userId, subscription.endpoint).catch((error: unknown) => {
    console.warn("Could not remove push subscription during sign-out.", error);
  });
  await subscription.unsubscribe().catch((error: unknown) => {
    console.warn("Could not unsubscribe this browser from push.", error);
  });
}

signOutButton.addEventListener("click", async () => {
  setActionsDisabled(true);
  setStatus("Saindo…");
  try {
    await removeCurrentPushSubscription();
    await signOut();
    window.location.replace("index.html");
  } catch (error) {
    setStatus(`Não foi possível sair: ${errorMessage(error)}`);
    setActionsDisabled(false);
  }
});

deleteAccountButton.addEventListener("click", async () => {
  if (!window.confirm("Excluir sua conta e os dados sincronizados? Esta ação não pode ser desfeita.")) return;
  setActionsDisabled(true);
  setStatus("Excluindo conta…");
  try {
    await removeCurrentPushSubscription();
    await deleteAccount();
    window.location.replace("index.html");
  } catch (error) {
    setStatus(`Não foi possível excluir a conta: ${errorMessage(error)}`);
    setActionsDisabled(false);
  }
});

if (favoritesForm && (favoriteStores || favoriteProductTypes)) favoritesForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = favoritesForm.querySelector<HTMLButtonElement>("button[type='submit']")!;
  button.disabled = true;
  setStatus("Salvando preferências…");
  if (favoriteStores) preferences.favoriteStores = checkedValues(favoriteStores);
  if (favoriteProductTypes) preferences.favoriteProductTypes = checkedValues(favoriteProductTypes);
  try {
    await savePreferences(userId, preferences);
    setStatus("Preferências salvas e sincronizadas.");
  } catch (error) {
    setStatus(`Não foi possível salvar: ${errorMessage(error)}`);
  } finally {
    button.disabled = false;
  }
});

if (alertForm && alertProduct && alertStore && targetPrice) alertForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const productType = alertProduct.value;
  const price = Number(targetPrice.value);
  if (!productType || !Number.isFinite(price) || price <= 0) return;
  const button = alertForm.querySelector<HTMLButtonElement>("button[type='submit']")!;
  button.disabled = true;
  setStatus("Criando alerta…");
  try {
    await createAlertRule(userId, {
      store: alertStore.value || null,
      product: null,
      product_type: productType,
      target_price: price,
    });
    await refreshRules();
    targetPrice.value = "";
    setStatus("Alerta salvo. A entrega por notificação será ativada na próxima etapa.");
  } catch (error) {
    setStatus(`Não foi possível criar o alerta: ${errorMessage(error)}`);
  } finally {
    button.disabled = false;
  }
});

alertRulesList?.addEventListener("click", async (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rule-id]");
  const ruleId = button?.dataset.ruleId;
  if (!ruleId) return;
  button.disabled = true;
  try {
    await removeAlertRule(userId, ruleId);
    rules = rules.filter((rule) => rule.id !== ruleId);
    renderRules();
    setStatus("Alerta removido.");
  } catch (error) {
    setStatus(`Não foi possível remover: ${errorMessage(error)}`);
    button.disabled = false;
  }
});

notificationsPaused?.addEventListener("change", async () => {
  notificationsPaused.disabled = true;
  try {
    await setNotificationsPaused(userId, notificationsPaused.checked);
    setStatus(notificationsPaused.checked ? "Alertas pausados." : "Alertas retomados.");
  } catch (error) {
    notificationsPaused.checked = !notificationsPaused.checked;
    setStatus(`Não foi possível atualizar: ${errorMessage(error)}`);
  } finally {
    notificationsPaused.disabled = false;
  }
});

enablePushButton?.addEventListener("click", async () => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    setStatus("Este navegador não oferece suporte a notificações push.");
    return;
  }
  const approved = window.confirm("A Feira Boa poderá enviar alertas de preço que você criou, com produto, loja, preço e validade da oferta. Deseja ativar notificações neste dispositivo?");
  if (!approved) return;

  enablePushButton.disabled = true;
  setStatus("Solicitando permissão para notificações…");
  try {
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") {
      throw new Error(permission === "denied" ? "Permissão bloqueada no navegador. Altere-a nas configurações do site." : "Permissão não concedida.");
    }
    const registration = await navigator.serviceWorker.register("service-worker.js");
    const readyRegistration = await navigator.serviceWorker.ready;
    const subscription = await readyRegistration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(vapidPublicKey),
    });
    await savePushSubscription(userId, subscription);
    updatePushControls(true);
    setStatus("Notificações ativadas neste dispositivo.");
  } catch (error) {
    const message = errorMessage(error);
    setStatus(message.toLowerCase().includes("push service error")
      ? "O serviço de notificações do navegador falhou. Verifique a conexão e tente novamente."
      : `Não foi possível ativar notificações: ${message}`);
  } finally {
    enablePushButton.disabled = Notification.permission === "denied";
  }
});

disablePushButton?.addEventListener("click", async () => {
  disablePushButton.disabled = true;
  setStatus("Desativando notificações neste dispositivo…");
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await removePushSubscription(userId, subscription.endpoint);
      const removed = await subscription.unsubscribe();
      if (!removed) throw new Error("O navegador não confirmou o cancelamento.");
    }
    updatePushControls(false);
    setStatus("Notificações desativadas neste dispositivo.");
  } catch (error) {
    setStatus(`Não foi possível desativar notificações: ${errorMessage(error)}`);
  } finally {
    disablePushButton.disabled = false;
  }
});

void getCurrentUser()
  .then(async (user) => {
    if (!user) {
      window.location.replace("login.html?returnTo=account.html");
      return;
    }
    userId = user.id;
    email.textContent = user.email ?? "E-mail não disponível";
    const [settings, response] = await Promise.all([
      loadAccountSettings(user.id),
      fetch("offers.json").then(async (result) => {
        if (!result.ok) throw new Error("Não foi possível carregar as opções de ofertas.");
        return await result.json() as OfferFeed;
      }),
    ]);
    preferences = settings.preferences;
    if (pendingTheme) preferences.theme = pendingTheme;
    applyTheme(preferences.theme);
    preferencesLoaded = true;
    rules = settings.alertRules;
    if (notificationsPaused) notificationsPaused.checked = settings.notificationsPaused;
    const existingRegistration = await navigator.serviceWorker?.getRegistration();
    const currentSubscription = await existingRegistration?.pushManager.getSubscription();
    updatePushControls(Boolean(currentSubscription), settings.pushEnabled);

    const stores = [...new Set(response.offers.map((offer) => offer.store))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const productTypes = [...new Set(response.offers.flatMap((offer) => offer.productTypes))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    renderCheckboxes(favoriteStores, stores, preferences.favoriteStores);
    renderCheckboxes(favoriteProductTypes, productTypes, preferences.favoriteProductTypes);
    if (pendingTheme) await saveThemePreference(pendingTheme);
    if (alertStore) alertStore.replaceChildren(makeOption("Qualquer loja", ""), ...stores.map((store) => makeOption(store, store)));
    if (alertProduct) alertProduct.replaceChildren(makeOption("Escolha um tipo de produto", ""), ...productTypes.map((type) => makeOption(type, type)));
    renderRules();
    setStatus("Suas preferências estão sincronizadas.");
  })
  .catch((error: unknown) => {
    email.textContent = "Não foi possível verificar sua sessão";
    setStatus(`Tente novamente: ${errorMessage(error)}`);
    setActionsDisabled(true);
  });
