import { formatBrl, failureHint, formatDateTime, notificationStatus } from "../shared/alert-rules.mjs";
import type { NotificationEntry } from "../alerts";
import { alertsState } from "./state";
import { alertHistoryList, panelHistory, panelRules, tabHistory, tabRules } from "./dom";

function renderHistoryItem(entry: NotificationEntry): HTMLLIElement {
  const offer = alertsState.offersById.get(entry.offer_id);
  const status = notificationStatus(entry);

  const item = document.createElement("li");
  item.className = `history-item is-${status.key}`;

  const main = document.createElement("div");
  main.className = "history-item-main";
  const title = document.createElement("strong");
  title.textContent = offer?.name ?? "Oferta encerrada";
  const detail = document.createElement("p");
  detail.className = "history-item-meta";
  detail.textContent = offer
    ? `${offer.store} · ${formatBrl(offer.price)} · válida até ${offer.validTo}`
    : "Esta oferta já não está no catálogo.";
  const when = document.createElement("small");
  when.textContent = `Enviada em ${formatDateTime(entry.sent_at)}`;
  main.append(title, detail, when);

  const side = document.createElement("div");
  side.className = "history-item-side";
  const pill = document.createElement("span");
  pill.className = `status-pill is-${status.key}`;
  pill.textContent = status.label;
  side.append(pill);
  if (entry.result === "failed") {
    const reason = document.createElement("small");
    reason.className = "history-item-reason";
    reason.textContent = failureHint(entry.error_code);
    side.append(reason);
  }

  item.append(main, side);
  return item;
}

export function renderHistory(): void {
  if (!alertHistoryList) return;
  alertHistoryList.replaceChildren();
  if (alertsState.history.length === 0) {
    const empty = document.createElement("li");
    empty.className = "alerts-empty";
    const title = document.createElement("strong");
    title.textContent = "Nenhum aviso enviado ainda";
    const text = document.createElement("span");
    text.textContent = "Quando uma oferta chegar ao preço de um dos seus alertas, o aviso aparece aqui.";
    empty.append(title, text);
    alertHistoryList.append(empty);
    return;
  }
  for (const entry of alertsState.history) alertHistoryList.append(renderHistoryItem(entry));
}

/** Mostra a aba de alertas ou a de histórico. */
export function showTab(tab: "rules" | "history"): void {
  alertsState.tab = tab;
  const rulesActive = tab === "rules";
  if (tabRules) {
    tabRules.setAttribute("aria-pressed", String(rulesActive));
    tabRules.setAttribute("aria-selected", String(rulesActive));
  }
  if (tabHistory) {
    tabHistory.setAttribute("aria-pressed", String(!rulesActive));
    tabHistory.setAttribute("aria-selected", String(!rulesActive));
  }
  if (panelRules) panelRules.hidden = !rulesActive;
  if (panelHistory) panelHistory.hidden = rulesActive;
}
