import {
  createAlertRule,
  deleteAccount,
  errorMessage,
  getCurrentUser,
  loadAccountSettings,
  removeAlertRule,
  savePreferences,
  setNotificationsPaused,
  signOut,
  type AlertRule,
} from "./account";
import type { OfferFeed, ProfilePreferences } from "./types";

const email = document.querySelector<HTMLElement>("#account-email")!;
const status = document.querySelector<HTMLParagraphElement>("#account-status")!;
const signOutButton = document.querySelector<HTMLButtonElement>("#sign-out")!;
const deleteAccountButton = document.querySelector<HTMLButtonElement>("#delete-account")!;
const favoritesForm = document.querySelector<HTMLFormElement>("#favorite-preferences")!;
const alertForm = document.querySelector<HTMLFormElement>("#alert-rule-form")!;
const favoriteStores = document.querySelector<HTMLFieldSetElement>("#favorite-stores")!;
const favoriteProducts = document.querySelector<HTMLFieldSetElement>("#favorite-products")!;
const alertStore = document.querySelector<HTMLSelectElement>("#alert-store")!;
const alertProduct = document.querySelector<HTMLSelectElement>("#alert-product")!;
const targetPrice = document.querySelector<HTMLInputElement>("#target-price")!;
const alertRulesList = document.querySelector<HTMLUListElement>("#alert-rules")!;
const notificationsPaused = document.querySelector<HTMLInputElement>("#notifications-paused")!;
const pushStatus = document.querySelector<HTMLElement>("#push-status")!;

let userId = "";
let preferences: ProfilePreferences;
let rules: AlertRule[] = [];

function setStatus(message: string): void {
  status.textContent = message;
}

function setActionsDisabled(disabled: boolean): void {
  signOutButton.disabled = disabled;
  deleteAccountButton.disabled = disabled;
}

function makeOption(label: string, value: string): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function renderCheckboxes(container: HTMLFieldSetElement, values: string[], selected: string[]): void {
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

function checkedValues(container: HTMLFieldSetElement): string[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>("input:checked"), (input) => input.value);
}

function renderRules(): void {
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
  const settings = await loadAccountSettings(userId);
  rules = settings.alertRules;
  renderRules();
}

signOutButton.addEventListener("click", async () => {
  setActionsDisabled(true);
  setStatus("Saindo…");
  try {
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
    await deleteAccount();
    window.location.replace("index.html");
  } catch (error) {
    setStatus(`Não foi possível excluir a conta: ${errorMessage(error)}`);
    setActionsDisabled(false);
  }
});

favoritesForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = favoritesForm.querySelector<HTMLButtonElement>("button[type='submit']")!;
  button.disabled = true;
  setStatus("Salvando preferências…");
  preferences.favoriteStores = checkedValues(favoriteStores);
  preferences.favoriteProducts = checkedValues(favoriteProducts);
  try {
    await savePreferences(userId, preferences);
    setStatus("Preferências salvas e sincronizadas.");
  } catch (error) {
    setStatus(`Não foi possível salvar: ${errorMessage(error)}`);
  } finally {
    button.disabled = false;
  }
});

alertForm.addEventListener("submit", async (event) => {
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

alertRulesList.addEventListener("click", async (event) => {
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

notificationsPaused.addEventListener("change", async () => {
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
    rules = settings.alertRules;
    notificationsPaused.checked = settings.notificationsPaused;
    pushStatus.textContent = settings.pushEnabled ? "Ativado neste dispositivo" : "Ainda não ativado";

    const stores = [...new Set(response.offers.map((offer) => offer.store))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const productTypes = [...new Set(response.offers.map((offer) => offer.productType))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    renderCheckboxes(favoriteStores, stores, preferences.favoriteStores);
    renderCheckboxes(favoriteProducts, productTypes, preferences.favoriteProducts);
    alertStore.replaceChildren(makeOption("Qualquer loja", ""), ...stores.map((store) => makeOption(store, store)));
    alertProduct.replaceChildren(makeOption("Escolha um tipo de produto", ""), ...productTypes.map((type) => makeOption(type, type)));
    renderRules();
    setStatus("Suas preferências estão sincronizadas.");
  })
  .catch((error: unknown) => {
    email.textContent = "Não foi possível verificar sua sessão";
    setStatus(`Tente novamente: ${errorMessage(error)}`);
    setActionsDisabled(true);
  });
