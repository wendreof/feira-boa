// Avaliação de lojas (1 a 5 estrelas) na página de lojas.
// Média e quantidade são públicas (store_rating_summary); a nota do usuário só
// é carregada e salva com sessão ativa.
import { supabase } from "./supabase-client";
import { showToast } from "./shared/toast";

interface Summary {
  average: number;
  total: number;
}

const CARD_SELECTOR = ".store-source[data-store-id]";
const STAR_LABELS = ["1 estrela", "2 estrelas", "3 estrelas", "4 estrelas", "5 estrelas"];

let currentUserId: string | null = null;
let summaries = new Map<string, Summary>();
let mine = new Map<string, number>();

function cards(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(CARD_SELECTOR)];
}

function storeNameOf(card: HTMLElement): string {
  return card.querySelector("strong")?.textContent?.trim() || "esta loja";
}

function formatAverage(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

async function loadSummaries(): Promise<Map<string, Summary>> {
  const { data, error } = await supabase.rpc("store_rating_summary");
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.store_id, { average: Number(row.average), total: Number(row.total) }]));
}

async function loadMine(userId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.from("store_ratings").select("store_id, rating").eq("user_id", userId);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.store_id, Number(row.rating)]));
}

function summaryText(summary: Summary | undefined): string {
  if (!summary || summary.total === 0) return "Sem avaliações ainda";
  const count = summary.total === 1 ? "1 avaliação" : `${summary.total} avaliações`;
  return `★ ${formatAverage(summary.average)} · ${count}`;
}

async function rate(storeId: string, rating: number): Promise<void> {
  if (!currentUserId) return;
  const { error } = await supabase.from("store_ratings").upsert(
    { user_id: currentUserId, store_id: storeId, rating, updated_at: new Date().toISOString() },
    { onConflict: "user_id,store_id" },
  );
  if (error) throw error;
  mine.set(storeId, rating);
}

function renderBlock(card: HTMLElement, storeId: string): HTMLElement {
  const block = document.createElement("div");
  block.className = "store-rating";

  const summary = document.createElement("p");
  summary.className = "store-rating-summary";
  summary.textContent = summaryText(summaries.get(storeId));
  block.append(summary);

  if (currentUserId) {
    const current = mine.get(storeId) ?? 0;
    const group = document.createElement("div");
    group.className = "store-rating-stars";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", `Sua nota para ${storeNameOf(card)}`);
    STAR_LABELS.forEach((label, index) => {
      const value = index + 1;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `store-star${value <= current ? " is-on" : ""}`;
      button.dataset.rating = String(value);
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", String(value === current));
      button.textContent = "★";
      group.append(button);
    });
    block.append(group);
  } else {
    const hint = document.createElement("p");
    hint.className = "store-rating-hint";
    hint.textContent = "Entre na sua conta para avaliar esta loja.";
    block.append(hint);
  }

  const status = document.createElement("p");
  status.className = "store-rating-status";
  status.setAttribute("role", "status");
  block.append(status);
  return block;
}

function renderAll(): void {
  for (const card of cards()) {
    const storeId = card.dataset.storeId ?? "";
    card.querySelector(".store-rating")?.remove();
    card.append(renderBlock(card, storeId));
  }
}

async function refresh(): Promise<void> {
  try {
    summaries = await loadSummaries();
  } catch (error) {
    console.warn("Could not load store rating averages.", error);
  }
  if (currentUserId) {
    try {
      mine = await loadMine(currentUserId);
    } catch (error) {
      console.warn("Could not load your store ratings.", error);
    }
  }
  renderAll();
}

function bindStars(): void {
  document.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-rating]");
    const card = button?.closest<HTMLElement>(CARD_SELECTOR);
    if (!button || !card) return;
    const storeId = card.dataset.storeId ?? "";
    const status = card.querySelector<HTMLElement>(".store-rating-status");
    const stars = card.querySelectorAll<HTMLButtonElement>(".store-star");
    stars.forEach((star) => { star.disabled = true; });
    if (status) status.textContent = "Salvando sua nota…";
    try {
      const value = Number(button.dataset.rating);
      await rate(storeId, value);
      showToast(`Nota salva: ${value} de 5 para ${storeNameOf(card)}.`, "ok");
      await refresh();
    } catch (error) {
      console.warn("Could not save the store rating.", error);
      stars.forEach((star) => { star.disabled = false; });
      const failedStatus = card.querySelector<HTMLElement>(".store-rating-status");
      if (failedStatus) failedStatus.textContent = "Não foi possível salvar sua nota. Tente novamente.";
    }
  });
}

export async function initStoreRatings(): Promise<void> {
  if (cards().length === 0) return;
  const { data } = await supabase.auth.getSession();
  currentUserId = data.session?.user.id ?? null;
  bindStars();
  await refresh();
}
