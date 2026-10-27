import {
  errorMessage,
  getCurrentUser,
  hasPushSubscriptions,
  loadPreferences,
} from "./account";
import { loadAlertRules } from "./alerts";
import { applyTheme } from "./theme";
import { accountState } from "./account-ui/state";
import { bindPushControls, refreshPushDeviceState } from "./account-ui/push-controls";
import type { OfferFeed } from "./types";
import { alertsState } from "./alerts-ui/state";
import { bindRulesView, renderFormOptions, renderRules, renderSummary, setAlertsStatus } from "./alerts-ui/rules-view";

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

async function loadPage(userId: string): Promise<void> {
  accountState.userId = userId;
  alertsState.userId = userId;
  const [rules, pushEnabled, preferences] = await Promise.all([
    loadAlertRules(userId),
    hasPushSubscriptions(userId),
    loadPreferences(userId),
    loadCatalog(),
  ]);
  alertsState.rules = rules;
  accountState.accountPushEnabled = pushEnabled;
  applyTheme(preferences.theme);
  renderRules();
  await refreshPushDeviceState();
  renderSummary();
  setAlertsStatus("");
}

bindRulesView();
bindPushControls();

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
