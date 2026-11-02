import { loadAlertRules } from "../alerts";
import { shouldPromoteAlertsCreation } from "../shared/alert-rules.mjs";
import { appState } from "./state";

const panel = document.querySelector<HTMLAnchorElement>("#alerts-invite");
const copy = document.querySelector<HTMLElement>("#alerts-invite-copy");
const action = document.querySelector<HTMLElement>("#alerts-invite-action");

function loginHref(): string {
  const url = new URL("login.html", window.location.href);
  url.searchParams.set("returnTo", "alerts.html");
  return `${url.pathname}${url.search}`;
}

export function refreshAlertsInvitePanel(): void {
  if (!panel || !copy || !action) return;

  const rulesKnown = appState.currentUserId ? appState.enabledAlertRulesCount !== null : true;
  const enabledRuleCount = appState.currentUserId
    ? (appState.enabledAlertRulesCount ?? 0)
    : 0;

  if (!rulesKnown) {
    panel.hidden = true;
    return;
  }

  const visible = shouldPromoteAlertsCreation({
    enabledRuleCount,
    sharedOfferView: Boolean(appState.sharedOfferId),
    favoritesOnly: appState.favoriteOnly,
  });
  panel.hidden = !visible;
  if (!visible) return;

  if (appState.currentUserId) {
    panel.href = "alerts.html";
    copy.textContent = "Defina um preço-alvo e avisamos no Telegram ou no navegador quando aparecer uma oferta.";
    action.textContent = "Criar alerta de preço";
  } else {
    panel.href = loginHref();
    copy.textContent = "Conta grátis · avisos por Telegram ou push no navegador quando o preço baixar.";
    action.textContent = "Entrar e criar alerta";
  }
}

export async function syncAlertsInviteForUser(userId: string | null): Promise<void> {
  if (!userId) {
    appState.enabledAlertRulesCount = 0;
    refreshAlertsInvitePanel();
    return;
  }
  try {
    const rules = await loadAlertRules(userId);
    appState.enabledAlertRulesCount = rules.filter((rule) => rule.enabled).length;
  } catch (error) {
    console.warn("Could not load alert rules for the home invite.", error);
    appState.enabledAlertRulesCount = null;
  }
  refreshAlertsInvitePanel();
}
