import { errorMessage } from "../errors";
import {
  createAlertRule,
  deleteAlertRule,
  loadAlertRules,
  updateAlertRule,
  type AlertRule,
} from "../alerts";
import { accountState } from "../account-ui/state";
import { makeOption } from "../account-ui/options";
import {
  MAX_ALERT_RULES,
  alertsBanner,
  describeRule,
  parseTargetPrice,
  validateAlertRule,
  formatDateTime,
} from "../shared/alert-rules.mjs";
import { alertsState } from "./state";
import {
  alertForm,
  alertFormCancel,
  alertFormError,
  alertFormSubmit,
  alertFormTitle,
  alertProduct,
  alertRulesList,
  alertStore,
  alertsBanner as bannerElement,
  alertsBannerText,
  alertsCount,
  alertsStatus,
  summaryActive,
  summaryLimit,
  targetPrice,
} from "./dom";

export function setAlertsStatus(message: string): void {
  if (alertsStatus) alertsStatus.textContent = message;
}

function setFormError(message: string): void {
  if (!alertFormError) return;
  alertFormError.textContent = message;
  alertFormError.hidden = !message;
}

function deviceNotificationsPermissionDenied(): boolean {
  return "Notification" in window && Notification.permission === "denied";
}

/** Atualiza contadores do topo e o aviso de situação dos alertas. */
export function renderSummary(): void {
  const activeCount = alertsState.rules.length;
  if (summaryActive) summaryActive.textContent = String(activeCount);
  if (summaryLimit) summaryLimit.textContent = `${activeCount} de ${MAX_ALERT_RULES}`;
  if (alertsCount) alertsCount.textContent = `${activeCount} de ${MAX_ALERT_RULES}`;

  const banner = alertsBanner({
    activeCount,
    deviceEnabled: accountState.devicePushEnabled,
    permissionDenied: deviceNotificationsPermissionDenied(),
  });
  if (!bannerElement || !alertsBannerText) return;
  bannerElement.hidden = !banner;
  if (banner) {
    bannerElement.dataset.tone = banner.tone;
    alertsBannerText.textContent = banner.message;
  }
}

function ruleActionButton(label: string, action: string, ruleId: string, extraClass = "text-button"): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = extraClass;
  button.dataset.action = action;
  button.dataset.ruleId = ruleId;
  button.textContent = label;
  return button;
}

function renderRuleCard(rule: AlertRule): HTMLLIElement {
  const { title, scope, price } = describeRule(rule);

  const item = document.createElement("li");
  item.className = "alert-card";

  const main = document.createElement("div");
  main.className = "alert-card-main";

  const head = document.createElement("div");
  head.className = "alert-card-head";
  const name = document.createElement("strong");
  name.textContent = title;
  head.append(name);

  const meta = document.createElement("p");
  meta.className = "alert-card-meta";
  meta.textContent = `${scope} · avisar até ${price}`;

  const created = document.createElement("small");
  created.className = "alert-card-date";
  created.textContent = `Criado em ${formatDateTime(rule.created_at)}`;

  main.append(head, meta, created);

  const actions = document.createElement("div");
  actions.className = "alert-card-actions";
  actions.append(
    ruleActionButton("Editar", "edit", rule.id),
    ruleActionButton("Excluir", "delete", rule.id, "text-button danger-text"),
  );

  item.append(main, actions);
  return item;
}

export function renderRules(): void {
  if (!alertRulesList) return;
  alertRulesList.replaceChildren();
  if (alertsState.rules.length === 0) {
    const empty = document.createElement("li");
    empty.className = "alerts-empty";
    const title = document.createElement("strong");
    title.textContent = "Nenhum alerta ainda";
    const text = document.createElement("span");
    text.textContent = "Escolha um tipo de produto e o preço máximo que você quer pagar. Avisaremos quando uma oferta chegar nesse valor.";
    empty.append(title, text);
    alertRulesList.append(empty);
  } else {
    for (const rule of alertsState.rules) alertRulesList.append(renderRuleCard(rule));
  }
  renderSummary();
}

export async function refreshRules(): Promise<void> {
  alertsState.rules = await loadAlertRules(alertsState.userId);
  renderRules();
}

/** Preenche o formulário para edição, ou volta ao modo de criação quando `rule` é null. */
function setFormMode(rule: AlertRule | null): void {
  if (!alertForm || !alertFormTitle || !alertFormSubmit || !alertFormCancel) return;
  alertsState.editingId = rule?.id ?? null;
  setFormError("");
  alertFormTitle.textContent = rule ? "Editar alerta" : "Novo alerta";
  alertFormSubmit.textContent = rule ? "Salvar alterações" : "Criar alerta";
  alertFormCancel.hidden = !rule;

  if (rule && alertProduct && rule.product_type && !Array.from(alertProduct.options).some((option) => option.value === rule.product_type)) {
    alertProduct.append(makeOption(rule.product_type, rule.product_type));
  }
  if (rule && alertStore && rule.store && !Array.from(alertStore.options).some((option) => option.value === rule.store)) {
    alertStore.append(makeOption(rule.store, rule.store));
  }
  if (alertProduct) alertProduct.value = rule?.product_type ?? "";
  if (alertStore) alertStore.value = rule?.store ?? "";
  if (targetPrice) targetPrice.value = rule ? String(rule.target_price) : "";
  if (rule) alertForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Preenche as opções de loja e tipo de produto a partir do catálogo atual. */
export function renderFormOptions(): void {
  if (alertProduct) {
    alertProduct.replaceChildren(makeOption("Escolha um tipo de produto", ""), ...alertsState.productTypes.map((type) => makeOption(type, type)));
  }
  if (alertStore) {
    alertStore.replaceChildren(makeOption("Qualquer loja", ""), ...alertsState.stores.map((store) => makeOption(store, store)));
  }
}

async function submitForm(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!alertProduct || !alertStore || !targetPrice || !alertFormSubmit) return;
  const editingId = alertsState.editingId;
  const result = validateAlertRule({
    productType: alertProduct.value,
    store: alertStore.value,
    targetPrice: parseTargetPrice(targetPrice.value),
    productTypes: alertsState.productTypes,
    stores: alertsState.stores,
    rules: alertsState.rules,
    editingId,
  });
  if (!result.ok) {
    setFormError(result.error);
    return;
  }

  alertFormSubmit.disabled = true;
  setFormError("");
  setAlertsStatus(editingId ? "Salvando alterações…" : "Criando alerta…");
  try {
    if (editingId) {
      await updateAlertRule(alertsState.userId, editingId, result.value);
    } else {
      await createAlertRule(alertsState.userId, result.value);
    }
    await refreshRules();
    setFormMode(null);
    setAlertsStatus(editingId ? "Alerta atualizado." : "Alerta criado. Você será avisado quando uma oferta chegar a esse preço.");
  } catch (error) {
    setFormError(`Não foi possível salvar: ${errorMessage(error)}`);
  } finally {
    alertFormSubmit.disabled = false;
  }
}

async function runRuleAction(button: HTMLButtonElement): Promise<void> {
  const ruleId = button.dataset.ruleId;
  const action = button.dataset.action;
  const rule = alertsState.rules.find((item) => item.id === ruleId);
  if (!rule || !action) return;

  if (action === "edit") {
    setFormMode(rule);
    return;
  }

  if (action === "delete") {
    const { title, scope } = describeRule(rule);
    if (!window.confirm(`Excluir o alerta de ${title} (${scope})? Esta ação não pode ser desfeita.`)) return;
    button.disabled = true;
    try {
      await deleteAlertRule(alertsState.userId, rule.id);
      if (alertsState.editingId === rule.id) setFormMode(null);
      await refreshRules();
      setAlertsStatus("Alerta excluído.");
    } catch (error) {
      button.disabled = false;
      setAlertsStatus(`Não foi possível excluir: ${errorMessage(error)}`);
    }
    return;
  }

}

export function bindRulesView(): void {
  alertForm?.addEventListener("submit", (event) => submitForm(event));
  alertFormCancel?.addEventListener("click", () => {
    setFormMode(null);
    setAlertsStatus("");
  });
  alertRulesList?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (button) void runRuleAction(button);
  });
  setFormMode(null);
}
