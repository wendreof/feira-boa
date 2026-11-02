import { errorMessage, getCurrentUser, loadPreferences } from "./account";
import { loadNotificationHistory, type NotificationEntry } from "./alerts";
import { applyTheme } from "./theme";
import type { Offer, OfferFeed } from "./types";
import { failureHint, formatBrl, formatCalendarDate, formatDateTime, notificationStatus } from "./shared/alert-rules.mjs";
import { markMessagesSeen } from "./shared/notification-badge";

const listElement = document.querySelector<HTMLUListElement>("#messages-list");
const countElement = document.querySelector<HTMLElement>("#messages-count");
const statusElement = document.querySelector<HTMLParagraphElement>("#messages-status");

const offersById = new Map<string, Offer>();

function setStatus(message: string): void {
  if (statusElement) statusElement.textContent = message;
}

function messageTitle(entry: NotificationEntry, offer: Offer | undefined): string {
  if (entry.title) return entry.title;
  return offer ? `${offer.store}: ${offer.name}` : "Oferta encerrada";
}

function formatStoredBody(body: string): string {
  return body
    .replace(/válida até (\d{4})\/(\d{2})\/(\d{2})/g, "válida até $3/$2/$1")
    .replace(/válida até (\d{4})-(\d{2})-(\d{2})/g, "válida até $3/$2/$1");
}

function renderMessage(entry: NotificationEntry): HTMLLIElement {
  const offer = offersById.get(entry.offer_id);
  const status = notificationStatus(entry);

  const item = document.createElement("li");
  item.className = `message-item is-${status.key}`;

  const head = document.createElement("div");
  head.className = "message-head";
  const title = document.createElement("strong");
  title.textContent = messageTitle(entry, offer);
  const pill = document.createElement("span");
  pill.className = `status-pill is-${status.key}`;
  pill.textContent = status.label;
  const when = document.createElement("small");
  when.textContent = formatDateTime(entry.sent_at);
  head.append(title, pill, when);

  const content = document.createElement("div");
  content.className = "message-content";
  if (entry.body) {
    const body = document.createElement("p");
    body.className = "message-body";
    body.textContent = formatStoredBody(entry.body);
    content.append(body);
  } else {
    const missing = document.createElement("p");
    missing.className = "message-missing";
    missing.textContent = "O texto desta mensagem não foi guardado. Ela foi enviada antes da página Mensagens existir.";
    content.append(missing);
  }
  if (offer) {
    const detail = document.createElement("p");
    detail.className = "message-meta";
    detail.textContent = `${offer.store} · ${formatBrl(offer.price)} · válida até ${formatCalendarDate(offer.validTo)}`;
    content.append(detail);
    const link = document.createElement("a");
    link.className = "text-button";
    link.href = `index.html?offer=${encodeURIComponent(offer.id)}`;
    link.textContent = "Ver oferta";
    content.append(link);
  }
  if (entry.result === "failed") {
    const reason = document.createElement("p");
    reason.className = "message-reason";
    reason.textContent = failureHint(entry.error_code);
    content.append(reason);
  }

  item.append(head, content);
  return item;
}

function renderMessages(entries: NotificationEntry[]): void {
  if (!listElement) return;
  listElement.replaceChildren();
  if (countElement) countElement.textContent = `${entries.length} ${entries.length === 1 ? "mensagem" : "mensagens"}`;
  if (entries.length === 0) {
    const empty = document.createElement("li");
    empty.className = "alerts-empty";
    const title = document.createElement("strong");
    title.textContent = "Nenhuma mensagem ainda";
    const text = document.createElement("span");
    text.textContent = "Quando uma oferta chegar ao preço de um dos seus alertas, a mensagem aparece aqui.";
    empty.append(title, text);
    listElement.append(empty);
    return;
  }
  for (const entry of entries) listElement.append(renderMessage(entry));
}

async function loadCatalog(): Promise<void> {
  const response = await fetch("offers.json").then(async (result) => {
    if (!result.ok) throw new Error("Não foi possível carregar o catálogo de ofertas.");
    return await result.json() as OfferFeed;
  });
  for (const offer of response.offers) offersById.set(offer.id, offer);
}

async function loadPage(userId: string): Promise<void> {
  const [entries, profile] = await Promise.all([
    loadNotificationHistory(userId),
    loadPreferences(userId),
    loadCatalog(),
  ]);
  applyTheme(profile.preferences.theme);
  renderMessages(entries);
  setStatus("");
  // Abrir a lista marca tudo como lido; falha aqui não atrapalha a página.
  void markMessagesSeen().catch((error: unknown) => {
    console.warn("Could not mark messages as seen.", error);
  });
}

void getCurrentUser()
  .then(async (user) => {
    if (!user) {
      window.location.replace("login.html?returnTo=mensagens.html");
      return;
    }
    await loadPage(user.id);
  })
  .catch((error: unknown) => {
    setStatus(`Não foi possível carregar suas mensagens: ${errorMessage(error)}`);
  });
