import { createAlertRule, errorMessage, loadAccountSettings, removeAlertRule } from "../account";
import { accountState } from "./state";
import { setStatus } from "./ui";
import { alertForm, alertProduct, alertRulesList, alertStore, targetPrice } from "./dom";

export function makeOption(label: string, value: string): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

export function renderCheckboxes(container: HTMLFieldSetElement | null, values: string[], selected: string[]): void {
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

export function checkedValues(container: HTMLFieldSetElement | null): string[] {
  return container ? Array.from(container.querySelectorAll<HTMLInputElement>("input:checked"), (input) => input.value) : [];
}

export function renderRules(): void {
  if (!alertRulesList) return;
  alertRulesList.replaceChildren();
  for (const rule of accountState.rules) {
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
  if (accountState.rules.length === 0) {
    const empty = document.createElement("li");
    empty.className = "preference-empty";
    empty.textContent = "Você ainda não criou alertas de preço.";
    alertRulesList.append(empty);
  }
}

export async function refreshRules(): Promise<void> {
  if (!alertRulesList) return;
  const settings = await loadAccountSettings(accountState.userId);
  accountState.rules = settings.alertRules;
  renderRules();
}

async function submitAlertRule(form: HTMLFormElement, event: SubmitEvent): Promise<void> {
  if (!alertProduct || !alertStore || !targetPrice) return;
  event.preventDefault();
  const productType = alertProduct.value;
  const price = Number(targetPrice.value);
  if (!productType || !Number.isFinite(price) || price <= 0) return;
  const button = form.querySelector<HTMLButtonElement>("button[type='submit']")!;
  button.disabled = true;
  setStatus("Criando alerta…");
  try {
    await createAlertRule(accountState.userId, {
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
}

async function removeRuleFromEvent(event: Event): Promise<void> {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rule-id]");
  const ruleId = button?.dataset.ruleId;
  if (!button || !ruleId) return;
  button.disabled = true;
  try {
    await removeAlertRule(accountState.userId, ruleId);
    accountState.rules = accountState.rules.filter((rule) => rule.id !== ruleId);
    renderRules();
    setStatus("Alerta removido.");
  } catch (error) {
    setStatus(`Não foi possível remover: ${errorMessage(error)}`);
    button.disabled = false;
  }
}

export function bindRuleControls(): void {
  const form = alertForm;
  const list = alertRulesList;
  if (form) form.addEventListener("submit", (event) => submitAlertRule(form, event));
  if (list) list.addEventListener("click", (event) => removeRuleFromEvent(event));
}
