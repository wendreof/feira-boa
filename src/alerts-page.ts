import {
  errorMessage,
  getCurrentUser,
  hasPushSubscriptions,
  loadPreferences,
} from "./account";
import {
  loadAlertRules,
  loadNotificationHistory,
  loadNotificationsPaused,
  setNotificationsPaused,
} from "./alerts";
import { applyTheme } from "./theme";
import { accountState } from "./account-ui/state";
import { bindPushControls, refreshPushDeviceState } from "./account-ui/push-controls";
import type { OfferFeed } from "./types";
import { alertsState } from "./alerts-ui/state";
import { bindRulesView, renderFormOptions, renderRules, renderSummary, setAlertsStatus } from "./alerts-ui/rules-view";
import { renderHistory, showTab } from "./alerts-ui/history-view";
import { notificationsPaused, tabHistory, tabRules } from "./alerts-ui/dom";

async function refreshHistory(): Promise<void> {
  alertsState.history = await loadNotificationHistory(alertsState.userId);
  renderHistory();
  renderSummary();
}

async function togglePaused(toggle: HTMLInputElement): Promise<void> {
  toggle.disabled = true;
  try {
    await setNotificationsPaused(alertsState.userId, toggle.checked);
    alertsState.notificationsPaused = toggle.checked;
    renderRules();
    setAlertsStatus(toggle.checked ? "Todos os alertas estão pausados." : "Alertas retomados.");
  } catch (error) {
    toggle.checked = !toggle.checked;
    setAlertsStatus(`Não foi possível atualizar: ${errorMessage(error)}`);
  } finally {
    toggle.disabled = false;
  }
}

async function loadCatalog(): Promise<void> {
  const response = await fetch("offers.json").then(async (result) => {
    if (!result.ok) throw new Error("Não foi possível carregar o catálogo de ofertas.");
    return await result.json() as OfferFeed;
  });
  alertsState.offersById = new Map(response.offers.map((offer) => [offer.id, offer]));
  alertsState.stores = [...new Set(response.offers.map((offer) => offer.store))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  alertsState.productTypes = [...new Set(response.offers.flatMap((offer) => offer.productTypes))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  renderFormOptions();
}

function bindPage(): void {
  bindRulesView();
  bindPushControls();
  tabRules?.addEventListener("click", () => showTab("rules"));
  tabHistory?.addEventListener("click", () => {
    showTab("history");
    void refreshHistory().catch((error: unknown) => setAlertsStatus(`Não foi possível carregar o histórico: ${errorMessage(error)}`));
  });
  notificationsPaused?.addEventListener("change", () => {
    if (notificationsPaused) void togglePaused(notificationsPaused);
  });
  showTab("rules");
}

async function loadPage(userId: string): Promise<void> {
  accountState.userId = userId;
  alertsState.userId = userId;
  const [rules, paused, history, pushEnabled, preferences] = await Promise.all([
    loadAlertRules(userId),
    loadNotificationsPaused(userId),
    loadNotificationHistory(userId),
    hasPushSubscriptions(userId),
    loadPreferences(userId),
    loadCatalog(),
  ]);
  alertsState.rules = rules;
  alertsState.notificationsPaused = paused;
  alertsState.history = history;
  accountState.accountPushEnabled = pushEnabled;
  applyTheme(preferences.theme);
  if (notificationsPaused) notificationsPaused.checked = paused;
  renderRules();
  renderHistory();
  await refreshPushDeviceState();
  renderSummary();
  setAlertsStatus("");
}

bindPage();

void getCurrentUser()
  .then(async (user) => {
    if (!user) {
      window.location.replace("login.html?returnTo=alerts.html");
      return;
    }
    await loadPage(user.id);
  })
  .catch((error: unknown) => {
    setAlertsStatus(`Não foi possível carregar seus alertas: ${errorMessage(error)}`);
  });
