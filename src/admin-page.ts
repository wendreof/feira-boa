import { supabase } from "./supabase-client";
import type { OfferFeed } from "./types";
import {
  findSourceStatusForStore,
  monitoredSourceUrlForStore,
  sourceHealthLabel,
  summarizeCatalog,
  summarizeStoreCatalog,
} from "../scripts/domain/admin-catalog-summary.mjs";

interface AdminAccountStats {
  total_accounts: number;
  google_accounts: number;
  email_accounts: number;
  accounts_with_alerts: number;
  accounts_with_push: number;
  new_accounts_7d: number;
  new_accounts_30d: number;
}

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

interface BuildInfo {
  version: string;
  build: number;
  commit: string;
  builtAt: string;
  dirty: boolean;
}

interface SnapshotManifestEntry {
  role: "current" | "previous";
  storeId: string;
  storeName: string;
  branch: string;
  fetchedAt: string | null;
  supersededAt: string | null;
  offerCount: number;
  status: string;
  validFrom: string;
  validTo: string;
  sourceUrl: string;
}

interface SnapshotManifest {
  schemaVersion: number;
  updatedAt: string;
  current: SnapshotManifestEntry[];
  previous: SnapshotManifestEntry[];
}

interface SourceStatus {
  checkedAt?: string;
  lastSuccessAt?: string;
  error?: boolean;
  needsReview?: boolean;
  store?: string | null;
  branch?: string | null;
}

declare global {
  interface Window {
    FEIRA_SOURCE_STATUS?: Record<string, SourceStatus>;
  }
}

const status = document.querySelector<HTMLParagraphElement>("#admin-status")!;
const deploySection = document.querySelector<HTMLElement>("#admin-deploy")!;
const deployStats = document.querySelector<HTMLElement>("#admin-deploy-stats")!;
const catalogSection = document.querySelector<HTMLElement>("#admin-catalog")!;
const catalogStats = document.querySelector<HTMLElement>("#admin-catalog-stats")!;
const storesList = document.querySelector<HTMLElement>("#admin-stores")!;
const snapshotsSection = document.querySelector<HTMLElement>("#admin-snapshots")!;
const snapshotStats = document.querySelector<HTMLElement>("#admin-snapshot-stats")!;
const snapshotList = document.querySelector<HTMLElement>("#admin-snapshot-list")!;
const sourcesSection = document.querySelector<HTMLElement>("#admin-sources")!;
const sourceSummary = document.querySelector<HTMLElement>("#admin-source-summary")!;
const sourceList = document.querySelector<HTMLElement>("#admin-source-list")!;
const alertsSection = document.querySelector<HTMLElement>("#admin-alerts")!;
const alertStats = document.querySelector<HTMLElement>("#admin-alert-stats")!;
const accountsSection = document.querySelector<HTMLElement>("#admin-accounts")!;
const accountStats = document.querySelector<HTMLElement>("#admin-account-stats")!;

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

function statusBadge(tone: string, label: string): HTMLElement {
  return element("span", `admin-status-badge admin-status-badge--${tone}`, label);
}

function sourceRow(store: string, branch: string, url: string, tone: string, detail: string, badgeLabel: string): HTMLElement {
  const row = element("div", "store-source admin-source-row");
  const copy = element("div", "source-copy");
  copy.append(
    element("span", "source-kicker", "FONTE OFICIAL"),
    element("strong", "", store),
    element("span", "", branch),
    statusBadge(tone, badgeLabel),
    element("span", `source-freshness${tone === "ok" ? "" : " source-freshness-warning"}`, detail),
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

function storeCatalogRow(
  storeName: string,
  branch: string,
  detail: string,
  monitorTone: string,
  monitorLabel: string,
  url: string,
  note?: string,
): HTMLElement {
  const row = element("div", "store-source admin-store-row");
  const copy = element("div", "source-copy");
  copy.append(
    element("span", "source-kicker", "LOJA"),
    element("strong", "", storeName),
    element("span", "", branch),
    statusBadge(monitorTone, monitorLabel),
    element("span", "", detail),
  );
  if (note) copy.append(element("span", "admin-row-note", note));
  const link = document.createElement("a");
  link.className = "source-button";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Abrir folheto ↗";
  row.append(copy, link);
  return row;
}

function snapshotRow(entry: SnapshotManifestEntry): HTMLElement {
  const row = element("div", "store-source admin-snapshot-row");
  const copy = element("div", "source-copy");
  const roleLabel = entry.role === "previous" ? "Encarte anterior" : "Snapshot atual";
  const timing = entry.role === "previous"
    ? `Substituído em ${formatDateTime(entry.supersededAt)}`
    : `Ingestão ${formatDateTime(entry.fetchedAt)}`;
  copy.append(
    element("span", "source-kicker", roleLabel.toUpperCase()),
    element("strong", "", entry.storeName),
    element("span", "", entry.branch),
    statusBadge(entry.offerCount > 0 ? "ok" : "unknown", entry.status),
    element("span", "", `${entry.offerCount} ofertas · válido ${formatDate(entry.validFrom)} – ${formatDate(entry.validTo)} · ${timing}`),
  );
  const link = document.createElement("a");
  link.className = "source-button";
  link.href = entry.sourceUrl;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Abrir fonte ↗";
  row.append(copy, link);
  return row;
}

async function loadDeploy(): Promise<void> {
  const response = await fetch("build-info.json", { cache: "no-store" });
  if (!response.ok) throw new Error("build-info.json indisponível");
  const info = await response.json() as BuildInfo;
  deployStats.replaceChildren(
    statCard("Versão", info.version, `Build #${info.build}`),
    statCard("Commit", info.commit, info.dirty ? "Worktree sujo no build" : "Commit limpo"),
    statCard("Gerado em", formatDateTime(info.builtAt), "Horário de São Paulo"),
  );
  deploySection.hidden = false;
}

async function loadCatalog(): Promise<void> {
  const response = await fetch("offers.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Catálogo indisponível");
  const feed = await response.json() as OfferFeed;
  const today = todayInSaoPaulo();
  const sourceStatus = window.FEIRA_SOURCE_STATUS ?? {};
  const summary = summarizeCatalog(feed, today, sourceStatus);

  catalogStats.replaceChildren(
    statCard("Ofertas no feed", String(summary.totalOffers), `Feed atualizado ${formatDateTime(summary.updatedAt)}`),
    statCard("Ativas hoje", String(summary.activeCount), `${summary.storeCount} lojas · ${summary.storesWithoutActive} sem oferta ativa`),
    statCard("Encartes anteriores", String(summary.archivedOffers), `${summary.archivedCampaigns} loja(s) com histórico`),
    statCard("Expiram hoje/amanhã", String(summary.expiringSoon), "Ofertas ainda ativas"),
    statCard("Fontes em revisão", String(summary.sourcesNeedingReview), `${summary.sourcesWithErrors} com falha no monitor`),
  );

  const rows = feed.stores.map((store) => {
    const storeSummary = summarizeStoreCatalog(store, feed, today);
    const monitor = findSourceStatusForStore(store.name, sourceStatus);
    const health = sourceHealthLabel(monitor ?? {});
    const monitoredUrl = monitoredSourceUrlForStore(store.name, sourceStatus);
    const urlMismatch = monitoredUrl && monitoredUrl !== store.sourceUrl;
    const window = storeSummary.activeCount > 0
      ? `${formatDate(storeSummary.windowFrom)} – ${formatDate(storeSummary.windowTo)}`
      : `sem ofertas ativas · folheto ${formatDate(storeSummary.windowFrom)} – ${formatDate(storeSummary.windowTo)}`;
    const detail = `${storeSummary.activeCount} ativas · ${storeSummary.totalInFeed} no feed · ${storeSummary.archivedCount} no encarte anterior · ${window}`;
    const note = urlMismatch
      ? "URL do feed difere do monitor — rode ingest/monitor após conferir."
      : storeSummary.archivedCount > 0
        ? `Último encarte arquivado válido até ${storeSummary.archivedValidTo ? formatDate(storeSummary.archivedValidTo) : "—"}.`
        : undefined;
    return storeCatalogRow(store.name, store.branch, detail, health.tone, health.label, store.sourceUrl, note);
  });
  storesList.replaceChildren(...rows);
  catalogSection.hidden = false;
}

async function loadSnapshots(): Promise<void> {
  const response = await fetch("snapshot-manifest.json", { cache: "no-store" });
  if (!response.ok) throw new Error("snapshot-manifest.json indisponível");
  const manifest = await response.json() as SnapshotManifest;
  const stale = manifest.current.filter((entry) => {
    if (!entry.fetchedAt) return true;
    return Date.now() - Date.parse(entry.fetchedAt) > 36 * 60 * 60 * 1000;
  }).length;

  snapshotStats.replaceChildren(
    statCard("Snapshots atuais", String(manifest.current.length), `Manifesto ${formatDateTime(manifest.updatedAt)}`),
    statCard("Encartes arquivados", String(manifest.previous.length), "Um por loja quando a campanha roda"),
    statCard("Ingestão >36h", String(stale), "Snapshots sem refresh recente"),
  );

  const rows = [...manifest.current, ...manifest.previous]
    .sort((left, right) => left.storeName.localeCompare(right.storeName, "pt-BR") || (left.role === "previous" ? 1 : -1))
    .map((entry) => snapshotRow(entry));
  snapshotList.replaceChildren(...rows);
  snapshotsSection.hidden = false;
}

function loadSources(): void {
  const sources = Object.entries(window.FEIRA_SOURCE_STATUS ?? {});
  if (sources.length === 0) {
    sourceSummary.replaceChildren(statCard("Monitor", "0", "Nenhuma verificação registrada"));
    sourceList.replaceChildren(element("p", "preferences-help", "Nenhuma verificação de fonte registrada."));
    sourcesSection.hidden = false;
    return;
  }

  const review = sources.filter(([, entry]) => entry.needsReview).length;
  const errors = sources.filter(([, entry]) => entry.error).length;
  const ok = sources.length - review - errors;
  sourceSummary.replaceChildren(
    statCard("Fontes monitoradas", String(sources.length), `${ok} OK · ${review} em revisão · ${errors} com falha`),
  );

  const rows = sources
    .sort(([urlA, a], [urlB, b]) => {
      const rank = (entry: SourceStatus) => (entry.needsReview ? 0 : entry.error ? 1 : 2);
      const diff = rank(a) - rank(b);
      return diff !== 0 ? diff : (a.store ?? urlA).localeCompare(b.store ?? urlB, "pt-BR");
    })
    .map(([url, source]) => {
      const health = sourceHealthLabel(source);
      const detail = source.needsReview
        ? `Verificada em ${formatDateTime(source.checkedAt)} · aguarda conferência manual`
        : source.error
          ? `Falha em ${formatDateTime(source.checkedAt)} · último sucesso ${formatDateTime(source.lastSuccessAt)}`
          : `Verificada em ${formatDateTime(source.checkedAt)} · último sucesso ${formatDateTime(source.lastSuccessAt)}`;
      return sourceRow(source.store ?? "Fonte", source.branch ?? "", url, health.tone, detail, health.label);
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

async function loadAccounts(): Promise<void> {
  const { data, error } = await supabase.rpc("get_admin_account_stats");
  if (error) throw error;
  const stats = (Array.isArray(data) ? data[0] : data) as AdminAccountStats | null;
  if (!stats) {
    accountStats.replaceChildren(statCard("Contas", "—", "Sem dados"));
    accountsSection.hidden = false;
    return;
  }
  accountStats.replaceChildren(
    statCard("Contas criadas", String(stats.total_accounts ?? 0), `${stats.new_accounts_7d ?? 0} nos últimos 7 dias · ${stats.new_accounts_30d ?? 0} em 30 dias`),
    statCard("Contas com Google", String(stats.google_accounts ?? 0), "Login por Google"),
    statCard("Contas por e-mail", String(stats.email_accounts ?? 0), "Login por e-mail e senha"),
    statCard("Contas com alertas", String(stats.accounts_with_alerts ?? 0), "Com ao menos uma regra"),
    statCard("Contas com push", String(stats.accounts_with_push ?? 0), "Com ao menos um dispositivo"),
  );
  accountsSection.hidden = false;
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
  const results = await Promise.allSettled([
    loadDeploy(),
    loadCatalog(),
    loadSnapshots(),
    loadSources(),
    loadAlerts(),
    loadAccounts(),
  ]);
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length > 0) {
    status.textContent = `Acesso confirmado, mas ${failures.length} bloco(s) não carregaram: ${failures.map((result) => (result.reason as Error)?.message ?? "erro").join(" · ")}`;
  }
}

void start();
