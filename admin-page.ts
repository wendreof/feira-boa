import { supabase } from "./supabase-client";
import type { OfferFeed } from "./types";

interface AdminAlertStats {
  window_days: number;
  sent: number;
  failed: number;
  users_with_alerts: number;
  rules_total: number;
  rules_enabled: number;
  subscriptions_total: number;
  last_sent_at: string | null;
}

const status = document.querySelector<HTMLParagraphElement>("#admin-status")!;
const catalogSection = document.querySelector<HTMLElement>("#admin-catalog")!;
const catalogStats = document.querySelector<HTMLElement>("#admin-catalog-stats")!;
const storesList = document.querySelector<HTMLElement>("#admin-stores")!;
const sourcesSection = document.querySelector<HTMLElement>("#admin-sources")!;
const sourceList = document.querySelector<HTMLElement>("#admin-source-list")!;
const alertsSection = document.querySelector<HTMLElement>("#admin-alerts")!;
const alertStats = document.querySelector<HTMLElement>("#admin-alert-stats")!;

function todayInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${part.year}-${part.month}-${part.day}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

function element(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statCard(label: string, value: string, note?: string): HTMLElement {
  const card = element("div", "admin-stat");
  card.append(element("span", "admin-stat-label", label), element("strong", "admin-stat-value", value));
  if (note) card.append(element("span", "admin-stat-note", note));
  return card;
}

function sourceRow(store: string, branch: string, url: string, state: string, detail: string): HTMLElement {
  const row = element("div", "store-source");
  const copy = element("div", "source-copy");
  copy.append(
    element("span", "source-kicker", "FONTE OFICIAL"),
    element("strong", "", store),
    element("span", "", branch),
    element("span", `source-freshness${state === "ok" ? "" : " source-freshness-warning"}`, detail),
  );
  const link = document.createElement("a");
  link.className = "source-button";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Abrir fonte ↗";
  row.append(copy, link);
  return row;
}

async function loadCatalog(): Promise<void> {
  const response = await fetch("offers.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Catálogo indisponível");
  const feed = await response.json() as OfferFeed;
  const today = todayInSaoPaulo();
  const active = feed.offers.filter((offer) => today >= offer.validFrom && today <= offer.validTo);

  catalogStats.replaceChildren(
    statCard("Ofertas no feed", String(feed.offers.length), `Atualizado em ${formatDateTime(feed.updatedAt)}`),
    statCard("Ativas hoje", String(active.length), `Lojas monitoradas: ${feed.stores.length}`),
    statCard("Fontes com alerta", String(Object.values(window.FEIRA_SOURCE_STATUS ?? {}).filter((source) => source.needsReview).length), "Precisam de conferência"),
  );

  const rows = feed.stores.map((store) => {
    const storeOffers = active.filter((offer) => offer.store === store.name);
    const window = storeOffers.length > 0
      ? `${formatDate(storeOffers[0].validFrom)} – ${formatDate(storeOffers[0].validTo)}`
      : "sem ofertas ativas";
    const row = element("div", "store-source");
    const copy = element("div", "source-copy");
    copy.append(
      element("span", "source-kicker", "LOJA"),
      element("strong", "", store.name),
      element("span", "", store.branch),
      element("span", "", `${storeOffers.length} ofertas ativas · ${window}`),
    );
    const link = document.createElement("a");
    link.className = "source-button";
    link.href = store.sourceUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Abrir folheto ↗";
    row.append(copy, link);
    return row;
  });
  storesList.replaceChildren(...rows);
  catalogSection.hidden = false;
}

function loadSources(): void {
  const sources = Object.entries(window.FEIRA_SOURCE_STATUS ?? {});
  if (sources.length === 0) {
    sourceList.replaceChildren(element("p", "preferences-help", "Nenhuma verificação de fonte registrada."));
    sourcesSection.hidden = false;
    return;
  }
  const rows = sources.map(([url, source]) => {
    const state = source.needsReview ? "review" : source.error ? "error" : "ok";
    const detail = source.needsReview
      ? "Fonte mudou e aguarda conferência"
      : source.error
        ? "Falha na última verificação"
        : `Verificada em ${formatDateTime(source.checkedAt)} · último sucesso ${formatDateTime(source.lastSuccessAt)}`;
    return sourceRow(source.store ?? "Fonte", source.branch ?? "", url, state, detail);
  });
  sourceList.replaceChildren(...rows);
  sourcesSection.hidden = false;
}

async function loadAlerts(): Promise<void> {
  const { data, error } = await supabase.rpc("get_admin_alert_stats");
  if (error) throw error;
  const stats = (Array.isArray(data) ? data[0] : data) as AdminAlertStats | null;
  if (!stats) {
    alertStats.replaceChildren(statCard("Alertas", "—", "Sem dados no período"));
    alertsSection.hidden = false;
    return;
  }
  alertStats.replaceChildren(
    statCard("Alertas enviados", String(stats.sent ?? 0), `Último envio: ${formatDateTime(stats.last_sent_at)}`),
    statCard("Falhas de envio", String(stats.failed ?? 0), "Janela de 30 dias"),
    statCard("Contas com alertas", String(stats.users_with_alerts ?? 0), "Somente contagem"),
    statCard("Regras ativas", `${stats.rules_enabled ?? 0}/${stats.rules_total ?? 0}`, "Alertas de preço"),
    statCard("Dispositivos push", String(stats.subscriptions_total ?? 0), "Endpoints não são exibidos"),
  );
  alertsSection.hidden = false;
}

async function start(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) {
    status.textContent = "Entre com a conta de administrador para ver esta página.";
    return;
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) {
    status.textContent = "Não foi possível verificar o acesso administrativo.";
    return;
  }
  if (!isAdmin) {
    status.textContent = "Esta conta não tem acesso ao painel de operação.";
    return;
  }

  status.textContent = `Acesso confirmado para ${user.email ?? "conta administrativa"}.`;
  const results = await Promise.allSettled([loadCatalog(), loadSources(), loadAlerts()]);
  for (const result of results) {
    if (result.status === "rejected") {
      status.textContent = `Acesso confirmado, mas parte dos dados não carregou: ${(result.reason as Error)?.message ?? "erro"}`;
    }
  }
}

void start();
