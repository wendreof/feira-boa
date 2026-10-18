import { errorMessage, getCurrentUser, loadPreferences, savePreferences } from "./account";
import type { Offer, OfferFeed, ProfilePreferences } from "./types";
import { applyTheme, bindThemeToggle, type ThemePreference } from "./theme";
import { deleteOfferReaction, loadOfferReactionCounts, loadUserOfferReactions, saveOfferReaction, type OfferReaction, type OfferReactionCounts } from "./offer-reactions";
import { resolveDefaultViewMode } from "./view-mode.js";
import { showTransientStatus } from "./status-toast.js";

declare global {
  interface Window {
    FEIRA_SOURCE_ALERTS?: Array<{ url: string; message: string }>;
    FEIRA_SOURCE_STATUS?: Record<string, { checkedAt?: string; lastSuccessAt?: string; error?: boolean; needsReview?: boolean }>;
  }
}

(async function startApp(): Promise<void> {
const feedResponse = await fetch("offers.json");
if (!feedResponse.ok) throw new Error(`Offer feed unavailable: ${feedResponse.status}`);
const feed = await feedResponse.json() as OfferFeed;
const offers = feed.offers;
const storeNames = ["Todas as lojas", ...new Set(offers.map((offer) => offer.store))];
const departments = ["Todos os setores", ...new Set(offers.map((offer) => offer.department))];
const grid = document.querySelector<HTMLDivElement>("#offer-grid")!;
const filters = document.querySelector<HTMLDivElement>("#filters")!;
const storeFilters = document.querySelector<HTMLDivElement>("#store-filters")!;
const popularItems = document.querySelector<HTMLDivElement>("#popular-items")!;
const input = document.querySelector<HTMLInputElement>("#search-input")!;
const priceMin = document.querySelector<HTMLInputElement>("#price-min")!;
const priceMax = document.querySelector<HTMLInputElement>("#price-max")!;
const productTypeSelect = document.querySelector<HTMLSelectElement>("#product-type")!;
const sortSelect = document.querySelector<HTMLSelectElement>("#sort-order")!;
const emptyState = document.querySelector<HTMLDivElement>("#empty-state")!;
const resultsSubtitle = document.querySelector<HTMLParagraphElement>("#results-subtitle")!;
const resultsTitle = document.querySelector<HTMLHeadingElement>("#results-title")!;
const showAllOffersButton = document.querySelector<HTMLButtonElement>("#show-all-offers")!;
const shareStatus = document.querySelector<HTMLParagraphElement>("#share-status")!;
const emptyHelp = document.querySelector<HTMLSpanElement>("#empty-help")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset-filters")!;
const viewToggle = document.querySelector<HTMLDivElement>("#view-toggle")!;
const accountAccess = document.querySelector<HTMLAnchorElement>("#account-access")!;
const accountPanel = document.querySelector<HTMLDivElement>("#account-panel")!;
const navAccountLink = document.querySelector<HTMLAnchorElement>("#nav-account")!;
const navAccountLabel = navAccountLink.querySelector<HTMLElement>("[data-account-label]")!;
const mobileNavAccountLink = document.querySelector<HTMLAnchorElement>("#mobile-nav-account")!;
const mobileNavAccountLabel = mobileNavAccountLink.querySelector<HTMLElement>("[data-mobile-account-label]")!;
const accountDescription = document.querySelector<HTMLSpanElement>("#account-description")!;
const accountStatus = document.querySelector<HTMLParagraphElement>("#account-status")!;
const favoritesToggle = document.querySelector<HTMLButtonElement>("#favorites-toggle")!;
const navFavoritesLink = document.querySelector<HTMLAnchorElement>("#nav-favorites")!;
const mobileNavOffersLink = document.querySelector<HTMLAnchorElement>("#mobile-nav-offers")!;
const mobileNavFavoritesLink = document.querySelector<HTMLAnchorElement>("#mobile-nav-favorites")!;
const activeFilterCount = document.querySelector<HTMLSpanElement>("#active-filter-count")!;
let activeDepartment = "Todos os setores";
let activeStore = "Todas as lojas";
let activeProductType = "";
let favoriteIds = readGuestFavorites();
let favoriteOnly = new URLSearchParams(window.location.search).get("view") === "favorites";
const mobileViewMedia = window.matchMedia("(max-width: 760px)");
let viewMode: "grid" | "list" = readViewMode();
let currentUserId: string | null = null;
let preferencesLoaded = false;
let pendingTheme: ThemePreference | null = null;
let reactionCounts = new Map<string, OfferReactionCounts>();
let userReactions = new Map<string, OfferReaction>();
let sharedOfferId = new URLSearchParams(window.location.search).get("offer");
if (favoriteOnly) {
  navFavoritesLink.setAttribute("aria-current", "page");
  mobileNavFavoritesLink.setAttribute("aria-current", "page");
} else {
  mobileNavOffersLink.setAttribute("aria-current", "page");
}
if (sharedOfferId && !offers.some((offer) => offer.id === sharedOfferId)) sharedOfferId = null;

function readGuestFavorites(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("feira-boa:favorites:v1") ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function readViewMode(): "grid" | "list" {
  try {
    return resolveDefaultViewMode(localStorage.getItem("feira-boa:view-mode:v1"), mobileViewMedia.matches);
  } catch {
    return resolveDefaultViewMode(null, mobileViewMedia.matches);
  }
}

function updateViewMode(): void {
  grid.classList.toggle("list-view", viewMode === "list");
  viewToggle.querySelectorAll<HTMLButtonElement>("[data-view-mode]").forEach((button) => {
    const isSelected = button.dataset.viewMode === viewMode;
    button.setAttribute("aria-pressed", String(isSelected));
    button.disabled = mobileViewMedia.matches && button.dataset.viewMode !== "list";
  });
}

function persistViewMode(mode: "grid" | "list"): void {
  try {
    localStorage.setItem("feira-boa:view-mode:v1", mode);
  } catch {
    // Keep the selected view for this page even when storage is unavailable.
  }
}

function setAccountStatus(message: string): void {
  accountStatus.textContent = message;
}

function updateAccountControls(): void {
  const signedIn = currentUserId !== null;
  accountPanel.hidden = signedIn;
  accountAccess.hidden = signedIn;
  navAccountLabel.textContent = signedIn ? "Minha conta" : "Entrar";
  navAccountLink.setAttribute("aria-label", signedIn ? "Minha conta" : "Entrar");
  navAccountLink.setAttribute("href", signedIn ? "account.html" : "login.html");
  mobileNavAccountLabel.textContent = signedIn ? "Minha conta" : "Entrar";
  mobileNavAccountLink.setAttribute("aria-label", signedIn ? "Minha conta" : "Entrar");
  mobileNavAccountLink.setAttribute("href", signedIn ? "account.html" : "login.html");
  accountDescription.textContent = signedIn
    ? "Seus favoritos já estão sincronizados com a sua conta."
    : "Entre ou crie uma conta grátis para sincronizar seus favoritos.";
  if (signedIn) setAccountStatus("Conta conectada. Seus favoritos estão sincronizados.");
}

function persistGuestFavorites(): void {
  try {
    localStorage.setItem("feira-boa:favorites:v1", JSON.stringify([...favoriteIds]));
  } catch {
    setAccountStatus("Não foi possível salvar favoritos neste navegador.");
  }
}

async function saveFavoriteChanges(): Promise<void> {
  persistGuestFavorites();
  if (currentUserId) {
    try {
      preferences.favoriteOfferIds = [...favoriteIds];
      await savePreferences(currentUserId, preferences);
      setAccountStatus("Favoritos sincronizados.");
    } catch (error) {
      setAccountStatus(`Favoritos salvos neste dispositivo. Sincronização falhou: ${errorMessage(error)}`);
    }
  }
}

let preferences: ProfilePreferences = {
  favoriteOfferIds: [...favoriteIds], favoriteStores: [], favoriteProductTypes: [], theme: "light",
};

bindThemeToggle((theme) => {
  preferences.theme = theme;
  pendingTheme = theme;
  if (currentUserId && preferencesLoaded) void saveThemePreference(theme);
});

async function saveThemePreference(theme: ThemePreference): Promise<void> {
  if (!currentUserId) return;
  try {
    await savePreferences(currentUserId, preferences);
    pendingTheme = null;
    setAccountStatus("Tema salvo nas preferências da sua conta.");
  } catch (error) {
    setAccountStatus(`Tema aplicado neste dispositivo. Não foi possível sincronizar: ${errorMessage(error)}`);
  }
}

async function connectAccount(userId: string): Promise<void> {
  currentUserId = userId;
  updateAccountControls();
  try {
    const remotePreferences = await loadPreferences(userId);
    preferences = {
      ...remotePreferences,
      favoriteOfferIds: [...new Set([...remotePreferences.favoriteOfferIds, ...favoriteIds])],
      theme: pendingTheme ?? remotePreferences.theme,
    };
    applyTheme(preferences.theme);
    favoriteIds = new Set(preferences.favoriteOfferIds);
    await savePreferences(userId, preferences);
    pendingTheme = null;
    preferencesLoaded = true;
    persistGuestFavorites();
    try {
      userReactions = await loadUserOfferReactions(userId);
    } catch (reactionError) {
      console.warn("Could not load saved offer reactions.", reactionError);
    }
    renderOffers();
    setAccountStatus("Conta conectada. Seus favoritos estão sincronizados.");
  } catch (error) {
    setAccountStatus(`Conta conectada. Não foi possível sincronizar preferências: ${errorMessage(error)}`);
  }
}

const searchEquivalents: Record<string, string[]> = { iogurte: ["iog"], higienico: ["hig"], higienica: ["hig"] };
const commonItems = [
  {label:"Café", icon:"☕", query:"café"}, {label:"Leite", icon:"🥛", query:"leite"},
  {label:"Arroz", icon:"🍚", query:"arroz"}, {label:"Frango", icon:"🍗", query:"frango"},
  {label:"Carne", icon:"🥩", query:"carne"}, {label:"Tomate", icon:"🍅", query:"tomate"},
  {label:"Cerveja", icon:"🍺", query:"cerveja"}, {label:"Sabão", icon:"🧺", query:"sabão"},
  {label:"Papel higiênico", icon:"🧻", query:"papel higiênico"}, {label:"Iogurte", icon:"🥣", query:"iogurte"}
];

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"}).format(value);
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {day:"2-digit", month:"short"})
    .format(new Date(`${value}T12:00:00`)).replace(" de ", " ").replace(".", "");
}

function formatFeedUpdate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Atualização das ofertas indisponível";
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo",
  }).format(date).replace(/\./g, "");
  const timeLabel = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(date);
  return `Ofertas atualizadas em ${dateLabel}, às ${timeLabel}`;
}

function normalizeSearch(value: string): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function todayInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo", year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(new Date());
  const part = Object.fromEntries(parts.map(({type, value}) => [type, value]));
  return `${part.year}-${part.month}-${part.day}`;
}

function isActive(offer: Offer): boolean {
  const today = todayInSaoPaulo();
  return today >= offer.validFrom && today <= offer.validTo;
}

function matchesSearch(offer: Offer, query: string): boolean {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const searchable = normalizeSearch([offer.name, offer.brand, offer.detail, offer.category, offer.department, ...offer.productTypes, offer.store, offer.branch, offer.note].join(" "));
  const words = searchable.split(" ");
  return terms.every((term) => {
    const variants = [term, ...(searchEquivalents[term] || [])];
    return variants.some((variant) => searchable.includes(variant) || words.some((word) => word.startsWith(variant)));
  });
}

function renderStoreFilters(): void {
  storeFilters.innerHTML = storeNames.map((store) => {
    const count = offers.filter((offer) => isActive(offer) && (store === "Todas as lojas" || offer.store === store)).length;
    const disabled = store !== "Todas as lojas" && count === 0;
    return `<button class="filter ${store === activeStore ? "active" : ""}" type="button" data-store="${store}"${disabled ? " disabled title=\"Sem ofertas ativas hoje\"" : ""}>${store} · ${count}</button>`;
  }).join("");
}

function renderPopularItems(): void {
  popularItems.innerHTML = commonItems.map(({label, icon, query}) =>
    `<button class="popular-item" type="button" data-query="${query}" aria-label="Buscar ${label}"><span aria-hidden="true">${icon}</span><small>${label}</small></button>`
  ).join("");
}

function renderFilters(): void {
  filters.innerHTML = departments.map((department) => {
    const count = offers.filter((offer) => isActive(offer) && (department === "Todos os setores" || offer.department === department)).length;
    const disabled = department !== "Todos os setores" && count === 0;
    return `<button class="filter ${department === activeDepartment ? "active" : ""}" type="button" data-department="${department}"${disabled ? " disabled title=\"Sem ofertas ativas hoje\"" : ""}>${department} · ${count}</button>`;
  }).join("");

  const types = [...new Set(offers.filter((offer) => isActive(offer) && (activeDepartment === "Todos os setores" || offer.department === activeDepartment) && (activeStore === "Todas as lojas" || offer.store === activeStore)).flatMap((offer) => offer.productTypes))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  productTypeSelect.innerHTML = `<option value="">Todos os tipos</option>${types.map((type) => `<option value="${type}">${type}</option>`).join("")}`;
  if (!types.includes(activeProductType)) activeProductType = "";
  productTypeSelect.value = activeProductType;
}

function getPriceBounds(): { min: number | null; max: number | null } {
  const min = priceMin.value.trim() ? Number(priceMin.value.replace(",", ".")) : null;
  const max = priceMax.value.trim() ? Number(priceMax.value.replace(",", ".")) : null;
  return { min: min !== null && Number.isFinite(min) ? min : null, max: max !== null && Number.isFinite(max) ? max : null };
}

function renderOffers(): void {
  const {min, max} = getPriceBounds();
  const activeCount = Number(activeStore !== "Todas as lojas") + Number(activeDepartment !== "Todos os setores") + Number(Boolean(activeProductType)) + Number(min !== null || max !== null);
  activeFilterCount.hidden = activeCount === 0;
  activeFilterCount.textContent = String(activeCount);
  const priceRangeReversed = min !== null && max !== null && min > max;
  let matching = priceRangeReversed ? [] : offers.filter((offer) =>
    (sharedOfferId ? offer.id === sharedOfferId : isActive(offer)) && (sharedOfferId || activeStore === "Todas as lojas" || offer.store === activeStore) &&
    (sharedOfferId || activeDepartment === "Todos os setores" || offer.department === activeDepartment) &&
    (sharedOfferId || !activeProductType || offer.productTypes.includes(activeProductType)) &&
    (sharedOfferId || !favoriteOnly || favoriteIds.has(offer.id)) &&
    (sharedOfferId || min === null || offer.price >= min) && (sharedOfferId || max === null || offer.price <= max) && (sharedOfferId || matchesSearch(offer, input.value))
  );
  if (sortSelect.value === "price-low") matching = matching.sort((a, b) => a.price - b.price);
  if (sortSelect.value === "price-high") matching = matching.sort((a, b) => b.price - a.price);
  if (sortSelect.value === "discount") matching = matching.sort((a, b) => ((b.previousPrice ?? b.price) - b.price) - ((a.previousPrice ?? a.price) - a.price));

  grid.innerHTML = matching.map((offer) => {
    const storeInitials = offer.store.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
    const counts = reactionCounts.get(offer.id) ?? { likes: 0, dislikes: 0 };
    const currentReaction = userReactions.get(offer.id);
    return `
    <article class="offer-card">
      <div class="visual" style="--tone:${offer.tone}"><span class="offer-sticker">OFERTA</span><span class="product-art" role="img" aria-label="Ilustração de ${offer.name}">${offer.icon}</span><button class="favorite-toggle favorite-toggle-art" type="button" data-favorite-id="${offer.id}" aria-pressed="${favoriteIds.has(offer.id)}" aria-label="${favoriteIds.has(offer.id) ? "Remover dos" : "Adicionar aos"} favoritos"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button></div>
      <div class="card-body"><div class="offer-store"><span class="offer-store-logo ${offer.store === "Big Bom" ? "bigbom-mark" : ""}"><span class="store-logo-fallback" aria-hidden="true">${storeInitials}</span>${offer.storeLogo ? `<img src="${offer.storeLogo}" alt="" loading="lazy" onload="this.parentElement.classList.add('has-logo')" onerror="this.remove()">` : ""}</span><span class="category">${offer.productType}</span></div><h3>${offer.name}</h3><span class="spec">${offer.brand ? `${offer.brand} · ` : ""}${offer.detail}</span>
        <div class="price-row"><div><span class="price">${money(offer.price)}</span>${offer.previousPrice ? `<span class="old-price">${money(offer.previousPrice)}</span>` : ""}</div><span class="valid-until">Válido<strong>${dateLabel(offer.validFrom)}–${dateLabel(offer.validTo)}</strong></span></div>
        <div class="offer-reactions" role="group" aria-label="Esta oferta vale a pena?">
          <button class="favorite-toggle favorite-toggle-reaction" type="button" data-favorite-id="${offer.id}" aria-pressed="${favoriteIds.has(offer.id)}" aria-label="${favoriteIds.has(offer.id) ? "Remover dos" : "Adicionar aos"} favoritos"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>
          <button class="offer-reaction-button${currentReaction === "like" ? " selected" : ""}" type="button" data-reaction="like" data-offer-id="${offer.id}" aria-pressed="${currentReaction === "like"}" aria-label="Gostei desta oferta, ${counts.likes} votos" title="${currentUserId ? "Gostei" : "Entre para avaliar e salvar seu voto"}"><span aria-hidden="true">👍</span><span>${counts.likes}</span></button>
          <button class="offer-reaction-button${currentReaction === "dislike" ? " selected" : ""}" type="button" data-reaction="dislike" data-offer-id="${offer.id}" aria-pressed="${currentReaction === "dislike"}" aria-label="Não gostei desta oferta, ${counts.dislikes} votos" title="${currentUserId ? "Não gostei" : "Entre para avaliar e salvar seu voto"}"><span aria-hidden="true">👎</span><span>${counts.dislikes}</span></button>
        </div>
        ${offer.note ? `<p class="offer-note">${offer.note}</p>` : ""}
        <div class="card-source"><span class="source-dot"></span>${offer.branch} · <a href="${offer.sourceUrl}" target="_blank" rel="noopener">ver oferta</a><button class="share-offer" type="button" data-share-id="${offer.id}" aria-label="Compartilhar ${offer.name}"><span aria-hidden="true">↗</span> Compartilhar</button></div>
      </div>
    </article>`;
  }).join("");
  emptyState.hidden = matching.length > 0;
  favoritesToggle.textContent = favoriteOnly ? `Ver todas (${favoriteIds.size})` : `Favoritos (${favoriteIds.size})`;
  favoritesToggle.setAttribute("aria-pressed", String(favoriteOnly));
  resultsTitle.textContent = sharedOfferId ? "Oferta compartilhada" : "Ofertas encontradas";
  showAllOffersButton.hidden = !sharedOfferId;
  const storeLabel = activeStore === "Todas as lojas" ? "todas as lojas" : activeStore;
  const sharedOffer = sharedOfferId ? matching[0] : null;
  resultsSubtitle.textContent = sharedOffer
    ? `${sharedOffer.name} · ${money(sharedOffer.price)} · ${sharedOffer.store}${isActive(sharedOffer) ? "" : " · oferta encerrada"}`
    : `${matching.length} ${matching.length === 1 ? "oferta ativa" : "ofertas ativas"} · ${storeLabel}${activeDepartment === "Todos os setores" ? "" : ` · ${activeDepartment}`}${activeProductType ? ` · ${activeProductType}` : ""}`;
  if (priceRangeReversed) emptyHelp.textContent = "O preço mínimo precisa ser menor ou igual ao preço máximo.";
  else if (offers.some(isActive)) emptyHelp.textContent = "Não encontramos ofertas com essa busca e esses filtros. Tente outra palavra ou limpe os filtros.";
  else emptyHelp.textContent = "Não há ofertas ativas hoje. Consulte os folhetos abaixo para ver as promoções mais recentes.";
}

function shareUrlForOffer(offerId: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("offer", offerId);
  return url.toString();
}

grid.addEventListener("click", async (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>("[data-share-id]");
  const offer = offers.find((item) => item.id === button?.dataset.shareId);
  if (!button || !offer) return;

  const url = shareUrlForOffer(offer.id);
  const title = `${offer.name} por ${money(offer.price)} · Feira Boa`;
  const text = `${offer.name} por ${money(offer.price)} no ${offer.store}. Confira a oferta:`;
  button.disabled = true;
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      showTransientStatus(shareStatus, "Oferta compartilhada.");
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      showTransientStatus(shareStatus, "Link da oferta copiado.");
    } else {
      window.prompt("Copie o link para compartilhar esta oferta:", url);
      showTransientStatus(shareStatus, "Link da oferta pronto para copiar.");
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    showTransientStatus(shareStatus, "Não foi possível abrir o compartilhamento. Tente novamente.");
  } finally {
    button.disabled = false;
  }
});

grid.addEventListener("click", async (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>("[data-reaction]");
  const offerId = button?.dataset.offerId;
  const reaction = button?.dataset.reaction;
  if (!button || !offerId || (reaction !== "like" && reaction !== "dislike")) return;

  if (!currentUserId) {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const loginUrl = new URL("login.html", window.location.href);
    loginUrl.searchParams.set("returnTo", returnTo);
    window.location.assign(loginUrl);
    return;
  }

  button.disabled = true;
  try {
    const previousReaction = userReactions.get(offerId);
    const counts = { ...(reactionCounts.get(offerId) ?? { likes: 0, dislikes: 0 }) };

    if (previousReaction === reaction) {
      await deleteOfferReaction(currentUserId, offerId);
      userReactions.delete(offerId);
      counts[reaction === "like" ? "likes" : "dislikes"] = Math.max(0, counts[reaction === "like" ? "likes" : "dislikes"] - 1);
      reactionCounts.set(offerId, counts);
      showTransientStatus(shareStatus, "Sua avaliação foi removida.");
    } else {
      await saveOfferReaction(currentUserId, offerId, reaction);
      userReactions.set(offerId, reaction);
      if (previousReaction && previousReaction !== reaction) {
        counts[previousReaction === "like" ? "likes" : "dislikes"] = Math.max(0, counts[previousReaction === "like" ? "likes" : "dislikes"] - 1);
      }
      counts[reaction === "like" ? "likes" : "dislikes"] += 1;
      reactionCounts.set(offerId, counts);
      showTransientStatus(shareStatus, "Sua avaliação foi salva.");
    }

    const refreshedCounts = await loadOfferReactionCounts();
    reactionCounts = refreshedCounts;
    renderOffers();
  } catch (error) {
    showTransientStatus(shareStatus, `Não foi possível salvar sua avaliação: ${errorMessage(error)}`);
  } finally {
    button.disabled = false;
  }
});

showAllOffersButton.addEventListener("click", () => {
  sharedOfferId = null;
  const url = new URL(window.location.href);
  url.searchParams.delete("offer");
  window.history.replaceState({}, "", url);
  renderOffers();
});

storeFilters.addEventListener("click", (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>("[data-store]");
  if (!button) return;
  activeStore = button.dataset.store ?? "Todas as lojas";
  renderStoreFilters(); renderFilters(); renderOffers();
});
popularItems.addEventListener("click", (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>("[data-query]");
  if (!button) return;
  input.value = button.dataset.query ?? ""; renderOffers(); input.focus();
});
filters.addEventListener("click", (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>("[data-department]");
  if (!button) return;
  activeDepartment = button.dataset.department ?? "Todos os setores";
  renderFilters(); renderOffers();
});
input.addEventListener("input", renderOffers);
priceMin.addEventListener("input", renderOffers);
priceMax.addEventListener("input", renderOffers);
productTypeSelect.addEventListener("change", () => { activeProductType = productTypeSelect.value; renderOffers(); });
sortSelect.addEventListener("change", renderOffers);
resetButton.addEventListener("click", () => {
  activeStore = "Todas as lojas"; activeDepartment = "Todos os setores"; activeProductType = "";
  input.value = ""; priceMin.value = ""; priceMax.value = ""; sortSelect.value = "recommended";
  renderStoreFilters(); renderFilters(); renderOffers(); input.focus();
});
viewToggle.addEventListener("click", (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>("[data-view-mode]");
  if (button?.dataset.viewMode !== "grid" && button?.dataset.viewMode !== "list") return;
  if (mobileViewMedia.matches) {
    viewMode = "list";
    persistViewMode(viewMode);
    updateViewMode();
    return;
  }
  viewMode = button.dataset.viewMode;
  persistViewMode(viewMode);
  updateViewMode();
});

mobileViewMedia.addEventListener?.("change", () => {
  viewMode = resolveDefaultViewMode(localStorage.getItem("feira-boa:view-mode:v1"), mobileViewMedia.matches);
  persistViewMode(viewMode);
  updateViewMode();
});
favoritesToggle.addEventListener("click", () => {
  favoriteOnly = !favoriteOnly;
  renderOffers();
});
grid.addEventListener("click", (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>("[data-favorite-id]");
  const offerId = button?.dataset.favoriteId;
  if (!offerId) return;
  if (favoriteIds.has(offerId)) favoriteIds.delete(offerId);
  else favoriteIds.add(offerId);
  preferences.favoriteOfferIds = [...favoriteIds];
  renderOffers();
  void saveFavoriteChanges();
});
document.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "/" && document.activeElement !== input) { event.preventDefault(); input.focus(); }
});

const sourceAlerts = window.FEIRA_SOURCE_ALERTS || [];
const sourceStatus = window.FEIRA_SOURCE_STATUS || {};
document.querySelectorAll<HTMLElement>("[data-source-url]").forEach((element) => {
  const status = sourceStatus[element.dataset.sourceUrl || ""];
  if (!status) return;
  const lastSuccess = status.lastSuccessAt ? new Date(status.lastSuccessAt) : null;
  const checked = status.checkedAt ? new Date(`${status.checkedAt}T00:00:00`) : null;
  const checkedLabel = checked && !Number.isNaN(checked.getTime()) ? ` · verificada em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(checked)}` : "";
  if (status.needsReview) {
    element.textContent = `A fonte mudou e aguarda conferência${checkedLabel}`;
    element.classList.add("source-freshness-warning");
  } else if (status.error) {
    const successLabel = lastSuccess && !Number.isNaN(lastSuccess.getTime()) ? ` Último acesso bem-sucedido: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(lastSuccess)}.` : " Ainda sem acesso bem-sucedido registrado.";
    element.textContent = `Não foi possível verificar a fonte agora.${successLabel}`;
    element.classList.add("source-freshness-error");
  } else if (checked) {
    element.textContent = `Fonte consultada em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(checked)} · isso não confirma que os preços foram atualizados.`;
  }
});
const updatedLabel = document.querySelector<HTMLSpanElement>("#updated-label")!;
updatedLabel.textContent = formatFeedUpdate(feed.updatedAt);
if (sourceAlerts.length > 0) {
  const sourceWord = sourceAlerts.length === 1 ? "fonte" : "fontes";
  updatedLabel.textContent += ` · ${sourceAlerts.length} ${sourceWord} aguardando conferência`;
}
updatedLabel.title = sourceAlerts.length
  ? "Há mudanças detectadas nas fontes oficiais que ainda aguardam conferência"
  : "Data da última atualização do catálogo de ofertas";
updateViewMode(); renderStoreFilters(); renderPopularItems(); renderFilters(); renderOffers();
void loadOfferReactionCounts().then((counts) => {
  reactionCounts = counts;
  renderOffers();
}).catch((error: unknown) => {
  console.warn("Could not load offer reaction totals.", error);
});
try {
  const user = await getCurrentUser();
  if (user) await connectAccount(user.id);
  else setAccountStatus("Favoritos salvos neste dispositivo. Entre para sincronizar entre dispositivos.");
} catch (error) {
  setAccountStatus(`Favoritos locais disponíveis. Conta temporariamente indisponível: ${errorMessage(error)}`);
}
})().catch((error: unknown) => {
  console.error("Feira Boa could not load offers.", error);
  document.querySelector<HTMLParagraphElement>("#results-subtitle")!.textContent = "Não foi possível carregar as ofertas. Tente novamente mais tarde.";
});
