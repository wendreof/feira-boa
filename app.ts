import { errorMessage, getCurrentUser, loadPreferences, savePreferences } from "./account";
import type { Offer, OfferFeed, ProfilePreferences } from "./types";

declare global {
  interface Window { FEIRA_SOURCE_ALERTS?: Array<{ url: string; message: string }> }
}
interface Window { FEIRA_SOURCE_ALERTS?: Array<{ url: string; message: string }> }

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
const navAccountLink = document.querySelector<HTMLAnchorElement>("#nav-account")!;
const accountDescription = document.querySelector<HTMLSpanElement>("#account-description")!;
const accountStatus = document.querySelector<HTMLParagraphElement>("#account-status")!;
const favoritesToggle = document.querySelector<HTMLButtonElement>("#favorites-toggle")!;
const activeFilterCount = document.querySelector<HTMLSpanElement>("#active-filter-count")!;
let activeDepartment = "Todos os setores";
let activeStore = "Todas as lojas";
let activeProductType = "";
let favoriteIds = readGuestFavorites();
let favoriteOnly = false;
let viewMode: "grid" | "list" = readViewMode();
let currentUserId: string | null = null;
let sharedOfferId = new URLSearchParams(window.location.search).get("offer");
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
    return localStorage.getItem("feira-boa:view-mode:v1") === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

function updateViewMode(): void {
  grid.classList.toggle("list-view", viewMode === "list");
  viewToggle.querySelectorAll<HTMLButtonElement>("[data-view-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.viewMode === viewMode));
  });
}

function setAccountStatus(message: string): void {
  accountStatus.textContent = message;
}

function updateAccountControls(): void {
  const signedIn = currentUserId !== null;
  accountAccess.hidden = signedIn;
  navAccountLink.textContent = signedIn ? "Minha conta" : "Entrar";
  navAccountLink.setAttribute("href", signedIn ? "account.html" : "login.html");
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
  favoriteOfferIds: [...favoriteIds], favoriteStores: [], favoriteProducts: [],
};

async function connectAccount(userId: string): Promise<void> {
  currentUserId = userId;
  updateAccountControls();
  try {
    const remotePreferences = await loadPreferences(userId);
    preferences = {
      ...remotePreferences,
      favoriteOfferIds: [...new Set([...remotePreferences.favoriteOfferIds, ...favoriteIds])],
    };
    favoriteIds = new Set(preferences.favoriteOfferIds);
    await savePreferences(userId, preferences);
    persistGuestFavorites();
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
  const searchable = normalizeSearch([offer.name, offer.brand, offer.detail, offer.category, offer.department, offer.productType, offer.store, offer.branch, offer.note].join(" "));
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

  const types = [...new Set(offers.filter((offer) => isActive(offer) && (activeDepartment === "Todos os setores" || offer.department === activeDepartment) && (activeStore === "Todas as lojas" || offer.store === activeStore)).map((offer) => offer.productType))].sort((a, b) => a.localeCompare(b, "pt-BR"));
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
    (sharedOfferId || !activeProductType || offer.productType === activeProductType) &&
    (sharedOfferId || !favoriteOnly || favoriteIds.has(offer.id)) &&
    (sharedOfferId || min === null || offer.price >= min) && (sharedOfferId || max === null || offer.price <= max) && (sharedOfferId || matchesSearch(offer, input.value))
  );
  if (sortSelect.value === "price-low") matching = matching.sort((a, b) => a.price - b.price);
  if (sortSelect.value === "price-high") matching = matching.sort((a, b) => b.price - a.price);
  if (sortSelect.value === "discount") matching = matching.sort((a, b) => ((b.previousPrice ?? b.price) - b.price) - ((a.previousPrice ?? a.price) - a.price));

  grid.innerHTML = matching.map((offer) => `
    <article class="offer-card">
      <div class="visual" style="--tone:${offer.tone}"><span class="product-art" role="img" aria-label="Ilustração de ${offer.name}">${offer.icon}</span><span class="offer-sticker">OFERTA</span><button class="favorite-toggle" type="button" data-favorite-id="${offer.id}" aria-pressed="${favoriteIds.has(offer.id)}" aria-label="${favoriteIds.has(offer.id) ? "Remover dos" : "Adicionar aos"} favoritos">${favoriteIds.has(offer.id) ? "♥" : "♡"}</button></div>
      <div class="card-body"><div class="offer-store"><span class="offer-store-logo ${offer.store === "Big Bom" ? "bigbom-mark" : ""}">${offer.storeLogo ? `<img src="${offer.storeLogo}" alt="${offer.store}" loading="lazy" onerror="this.parentElement.classList.add('logo-fallback');this.remove()">` : offer.store.slice(0,2)}</span><span class="category">${offer.productType} · ${offer.store}</span></div><h3>${offer.name}</h3><span class="spec">${offer.brand ? `${offer.brand} · ` : ""}${offer.detail}</span>
        <div class="price-row"><div><span class="price">${money(offer.price)}</span>${offer.previousPrice ? `<span class="old-price">${money(offer.previousPrice)}</span>` : ""}</div><span class="valid-until">Válido<strong>${dateLabel(offer.validFrom)}–${dateLabel(offer.validTo)}</strong></span></div>
        ${offer.note ? `<p class="offer-note">${offer.note}</p>` : ""}
        <div class="card-source"><span class="source-dot"></span>${offer.branch} · <a href="${offer.sourceUrl}" target="_blank" rel="noopener">ver oferta</a><button class="share-offer" type="button" data-share-id="${offer.id}" aria-label="Compartilhar ${offer.name}"><span aria-hidden="true">↗</span> Compartilhar</button></div>
      </div>
    </article>`).join("");
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
      shareStatus.textContent = "Oferta compartilhada.";
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      shareStatus.textContent = "Link da oferta copiado.";
    } else {
      window.prompt("Copie o link para compartilhar esta oferta:", url);
      shareStatus.textContent = "Link da oferta pronto para copiar.";
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    shareStatus.textContent = "Não foi possível abrir o compartilhamento. Tente novamente.";
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
  viewMode = button.dataset.viewMode;
  try {
    localStorage.setItem("feira-boa:view-mode:v1", viewMode);
  } catch {
    // Keep the selected view for this page even when storage is unavailable.
  }
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
