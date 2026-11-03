import { loadAlertRules } from "../alerts";
import { countEnabledAlertRules, shouldPromoteAlertsCreation } from "../shared/alert-rules.mjs";
import { appState } from "./state";

const DISMISS_KEY = "feira-boa-alerts-invite-dismissed-at";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

const shell = document.querySelector<HTMLElement>("#alerts-invite-shell");
const panel = document.querySelector<HTMLAnchorElement>("#alerts-invite");
const copy = document.querySelector<HTMLElement>("#alerts-invite-copy");
const action = document.querySelector<HTMLElement>("#alerts-invite-action");
const dismissButton = document.querySelector<HTMLButtonElement>("#alerts-invite-dismiss");

function loginHref(): string {
  const url = new URL("login.html", window.location.href);
  url.searchParams.set("returnTo", "alerts.html");
  return `${url.pathname}${url.search}`;
}

function inviteDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_MS;
  } catch {
    return false;
  }
}

function markInviteDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function bindAlertsInviteUi(): void {
  dismissButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    markInviteDismissed();
    if (shell) shell.hidden = true;
  });
}

export function refreshAlertsInvitePanel(): void {
  if (!shell || !panel || !copy || !action) return;

  if (!appState.alertsInviteBootstrapped || inviteDismissedRecently()) {
    shell.hidden = true;
    return;
  }

  const rulesKnown = appState.currentUserId ? appState.enabledAlertRulesCount !== null : true;
  const enabledRuleCount = appState.currentUserId
    ? (appState.enabledAlertRulesCount ?? 0)
    : 0;

  if (!rulesKnown) {
    shell.hidden = true;
    return;
  }

  const visible = shouldPromoteAlertsCreation({
    enabledRuleCount,
    sharedOfferView: Boolean(appState.sharedOfferId),
    favoritesOnly: appState.favoriteOnly,
  });
  shell.hidden = !visible;
  const wasDismissedBefore = (() => {
    try {
      return Boolean(localStorage.getItem(DISMISS_KEY));
    } catch {
      return false;
    }
  })();
  panel.classList.toggle("alerts-invite-panel--compact", wasDismissedBefore);
  if (!visible) return;

  if (appState.currentUserId) {
    panel.href = "alerts.html";
    copy.textContent = "Defina um preço-alvo e avisamos no Telegram ou no navegador quando aparecer uma oferta.";
    action.textContent = "Criar alerta de preço";
  } else {
    panel.href = loginHref();
    copy.textContent = panel.classList.contains("alerts-invite-panel--compact")
      ? "Alertas grátis quando o preço baixar."
      : "Conta grátis · avisos por Telegram ou push no navegador quando o preço baixar.";
    action.textContent = panel.classList.contains("alerts-invite-panel--compact")
      ? "Entrar"
      : "Entrar e criar alerta";
  }
}

export async function syncAlertsInviteForUser(userId: string | null): Promise<void> {
  if (!userId) {
    appState.enabledAlertRulesCount = 0;
    appState.alertsInviteBootstrapped = true;
    refreshAlertsInvitePanel();
    return;
  }
  try {
    const rules = await loadAlertRules(userId);
    appState.enabledAlertRulesCount = countEnabledAlertRules(rules);
  } catch (error) {
    console.warn("Could not load alert rules for the home invite.", error);
    appState.enabledAlertRulesCount = null;
  }
  appState.alertsInviteBootstrapped = true;
  refreshAlertsInvitePanel();
}
