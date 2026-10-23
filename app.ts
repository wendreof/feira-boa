import { errorMessage } from "./errors";
import type { Offer, OfferFeed, ProfilePreferences } from "./types";
import { applyTheme, bindThemeToggle, type ThemePreference } from "./theme";
import { resolveDefaultViewMode } from "./view-mode.js";
import { showTransientStatus } from "./status-toast.js";
import { applySourceFreshness } from "./source-freshness";
import {
  ALL_SECTORS_LABEL,
  TAXONOMY_GROUPS,
  categoryLabel,
  categoryOrder,
  discountRatio,
  resolveCategory,
} from "./catalog-taxonomy.mjs";

type AccountApi = typeof import("./account");
type ReactionsApi = typeof import("./offer-reactions");
type ViewMode = "grid" | "list";
type ReactionCounts = { likes: number; dislikes: number };

interface CardRefs {
  root: HTMLElement;
  art: HTMLElement;
  name: HTMLElement;
  brand: HTMLElement;
  spec: HTMLElement;
  info: HTMLElement;
  price: HTMLElement;
  oldPrice: HTMLElement;
  discount: HTMLElement;
  valid: HTMLElement;
  note: HTMLElement;
  branch: HTMLElement;
  sourceLink: HTMLAnchorElement;
  share: HTMLButtonElement;
  favoriteButtons: HTMLButtonElement[];
  like: HTMLButtonElement;
  likeCount: HTMLElement;
}

const feedStatus = document.querySelector<HTMLParagraphElement>("#feed-status")!;
const feedRetry = document.querySelector<HTMLButtonElement>("#feed-retry")!;
const resultsAnnouncement = document.querySelector<HTMLParagraphElement>("#results-announcement")!;
const topbar = document.querySelector<HTMLElement>(".topbar")!;

// O cabeçalho encolhe ao rolar para liberar espaço na tela.
const compactQuery = window.matchMedia("(max-width: 760px)");
let compactPending = false;
function updateCompactTopbar(): void {
  if (compactPending) return;
  compactPending = true;
  window.requestAnimationFrame(() => {
    compactPending = false;
    topbar.classList.toggle("is-compact", window.scrollY > 40);
  });
}
window.addEventListener("scroll", updateCompactTopbar, { passive: true });
compactQuery.addEventListener?.("change", updateCompactTopbar);

const reactionLoginDialog = document.querySelector<HTMLDialogElement>("#reaction-login-dialog")!;
const reactionLoginCancel = document.querySelector<HTMLButtonElement>("#reaction-login-cancel")!;
const reactionLoginContinue = document.querySelector<HTMLButtonElement>("#reaction-login-continue")!;
const reactionLoginTitle = document.querySelector<HTMLElement>("#reaction-login-title")!;
const reactionLoginDescription = document.querySelector<HTMLElement>("#reaction-login-description")!;
let reactionLoginTrigger: HTMLElement | null = null;
let pendingLoginCancel: (() => void) | null = null;

feedRetry.addEventListener("click", () => window.location.reload());

function loginUrlForCurrentPage(): URL {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const loginUrl = new URL("login.html", window.location.href);
  loginUrl.searchParams.set("returnTo", returnTo);
  return loginUrl;
}

type LoginIntent = "reaction" | "favorite";

const LOGIN_INTENT_COPY: Record<LoginIntent, { title: string; description: string; confirm: string }> = {
  reaction: {
    title: "Entre para avaliar",
    description: "Para curtir uma oferta, entre na sua conta. Seu voto fica salvo e ajuda outros compradores.",
    confirm: "Entre ou crie uma conta para curtir esta oferta.",
  },
  favorite: {
    title: "Entre para salvar favoritos",
    description: "Para salvar ofertas nos favoritos, entre na sua conta. Tudo fica sincronizado entre os seus dispositivos.",
    confirm: "Entre ou crie uma conta para salvar esta oferta nos favoritos.",
  },
};

function askForLogin(trigger: HTMLElement, intent: LoginIntent, onCancel?: () => void): void {
  const copy = LOGIN_INTENT_COPY[intent];
  reactionLoginTitle.textContent = copy.title;
  reactionLoginDescription.textContent = copy.description;
  pendingLoginCancel = onCancel ?? null;
  if (typeof reactionLoginDialog.showModal !== "function") {
    pendingLoginCancel = null;
    if (window.confirm(copy.confirm)) {
      window.location.assign(loginUrlForCurrentPage());
    } else {
      onCancel?.();
    }
    return;
  }
  if (reactionLoginDialog.open) {
    pendingLoginCancel = null;
    return;
  }
  reactionLoginTrigger = trigger;
  reactionLoginDialog.showModal();
}

reactionLoginCancel.addEventListener("click", () => reactionLoginDialog.close());
reactionLoginContinue.addEventListener("click", () => {
  const loginUrl = loginUrlForCurrentPage();
  pendingLoginCancel = null;
  reactionLoginDialog.close();
  window.location.assign(loginUrl);
});
reactionLoginDialog.addEventListener("click", (event: MouseEvent) => {
  if (event.target === reactionLoginDialog) reactionLoginDialog.close();
});
reactionLoginDialog.addEventListener("close", () => {
  const cancel = pendingLoginCancel;
  pendingLoginCancel = null;
  if (reactionLoginTrigger?.isConnected) reactionLoginTrigger.focus();
  reactionLoginTrigger = null;
  cancel?.();
});

function showFeedError(): void {
  feedStatus.hidden = false;
  feedStatus.dataset.state = "error";
  feedStatus.textContent = "Não foi possível carregar as ofertas. Verifique sua conexão e tente novamente.";
  feedRetry.hidden = false;
  document.querySelector<HTMLParagraphElement>("#results-subtitle")!.textContent = "";
}

(async function startApp(): Promise<void> {
  feedStatus.textContent = "Carregando ofertas…";
  const feedResponse = await fetch("offers.json", { cache: "no-cache" });
  if (!feedResponse.ok) throw new Error(`Offer feed unavailable: ${feedResponse.status}`);
  const feed = await feedResponse.json() as OfferFeed;
  if (!Array.isArray(feed.offers) || !Array.isArray(feed.stores)) throw new Error("Offer feed has an invalid shape.");

  const offers = feed.offers;
  const storeNames = ["Todas as lojas", ...new Set(offers.map((offer) => offer.store))];
  const categories = new Map(offers.map((offer) => [offer.id, resolveCategory(offer)]));
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
  const storesDirectoryLink = document.querySelector<HTMLAnchorElement>(".stores-directory-link")!;
  const resultsSubtitle = document.querySelector<HTMLParagraphElement>("#results-subtitle")!;
  const resultsTitle = document.querySelector<HTMLHeadingElement>("#results-title")!;
  const showAllOffersButton = document.querySelector<HTMLButtonElement>("#show-all-offers")!;
  const shareStatus = document.querySelector<HTMLParagraphElement>("#share-status")!;
  const emptyHelp = document.querySelector<HTMLSpanElement>("#empty-help")!;
  const resetButton = document.querySelector<HTMLButtonElement>("#reset-filters")!;
  const viewToggle = document.querySelector<HTMLDivElement>("#view-toggle")!;
  const accountAccess = document.querySelector<HTMLElement>("#account-access")!;
  const accountPanel = document.querySelector<HTMLElement>("#account-panel")!;
  const navAccountLink = document.querySelector<HTMLAnchorElement>("#nav-account")!;
  const navAccountLabel = navAccountLink.querySelector<HTMLElement>("[data-account-label]")!;
  const mobileNavAccountLink = document.querySelector<HTMLAnchorElement>("#mobile-nav-account")!;
  const mobileNavAccountLabel = mobileNavAccountLink.querySelector<HTMLElement>("[data-mobile-account-label]")!;
  const accountDescription = document.querySelector<HTMLSpanElement>("#account-description")!;
  const accountStatus = document.querySelector<HTMLParagraphElement>("#account-status")!;
  const topbarAccount = document.querySelector<HTMLAnchorElement>("#topbar-account");
  const topbarAccountImage = document.querySelector<HTMLImageElement>("#topbar-account-image");
  const topbarAccountFallback = document.querySelector<HTMLElement>("#topbar-account-fallback");
  const topbarHello = document.querySelector<HTMLElement>("#topbar-hello");
  const favoritesToggle = document.querySelector<HTMLButtonElement>("#favorites-toggle")!;
  const navFavoritesLink = document.querySelector<HTMLAnchorElement>("#nav-favorites")!;
  const mobileNavOffersLink = document.querySelector<HTMLAnchorElement>("#mobile-nav-offers")!;
  const mobileNavFavoritesLink = document.querySelector<HTMLAnchorElement>("#mobile-nav-favorites")!;
  const activeFilterCount = document.querySelector<HTMLSpanElement>("#active-filter-count")!;
  const updatedLabel = document.querySelector<HTMLSpanElement>("#updated-label")!;

  const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
  const feedDateFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo",
  });
  const feedTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });

  const searchEquivalents: Record<string, string[]> = { iogurte: ["iog"], higienico: ["hig"], higienica: ["hig"] };
  function offerCategory(offer: Offer): { groupId: string; subcategory: string } {
    return categories.get(offer.id) ?? { groupId: "outros", subcategory: "Outros" };
  }
  function offerOrder(offer: Offer): number {
    const [groupIndex, subIndex] = categoryOrder(offerCategory(offer));
    return groupIndex * 100 + subIndex;
  }
  const CATEGORY_ICONS: Record<string, string> = {
    frescos: "🥬", mercearia: "🥫", bebidas: "🥤", bebidas_alcoolicas: "🍺", congelados: "🧊", saudaveis: "🥗", limpeza: "🧺",
    higiene: "🧴", infantil: "🍼", pet: "🐾", casa: "🏠", churrasco: "🔥", vestuario: "👕", outros: "🏷️",
  };
  const CARNES_SUBCATEGORIES = new Set(["Açougue e carnes frescas", "Aves", "Peixaria e frutos do mar", "Frios e embutidos"]);
  const RANDOM_CATEGORY_ORDER = [...TAXONOMY_GROUPS].sort(() => Math.random() - 0.5).map((group) => group.id);

  let activeDepartment = "";
  let activeStore = "Todas as lojas";
  let activeProductType = "";
  let favoriteIds = new Set<string>();
  let favoriteOnly = new URLSearchParams(window.location.search).get("view") === "favorites";
  const mobileViewMedia = window.matchMedia("(max-width: 760px)");
  let viewMode: ViewMode = readViewMode();
  let currentUserId: string | null = null;
  let preferencesLoaded = false;
  let pendingTheme: ThemePreference | null = null;
  let reactionCounts = new Map<string, ReactionCounts>();
  let userReactions = new Map<string, import("./offer-reactions").OfferReaction>();
  let sharedOfferId = new URLSearchParams(window.location.search).get("offer");
  let accountApi: AccountApi | null = null;
  let reactionsApi: ReactionsApi | null = null;
  const cards = new Map<string, CardRefs>();

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

  function readViewMode(): ViewMode {
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

  function persistViewMode(mode: ViewMode): void {
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
    const label = signedIn ? "Minha conta" : "Entrar";
    const href = signedIn ? "account.html" : "login.html";
    accountPanel.hidden = signedIn;
    accountAccess.hidden = signedIn;
    navAccountLabel.textContent = label;
    navAccountLink.setAttribute("aria-label", label);
    navAccountLink.setAttribute("href", href);
    mobileNavAccountLabel.textContent = label;
    mobileNavAccountLink.setAttribute("aria-label", label);
    mobileNavAccountLink.setAttribute("href", href);
    if (topbarAccount) {
      topbarAccount.hidden = !signedIn;
      topbarAccount.setAttribute("href", "account.html");
      topbarAccount.setAttribute("aria-label", "Minha conta");
      if (signedIn) {
        // Default person icon until the photo loads (or if there is none).
        if (!topbarAccountImage?.src) renderTopbarAvatar(null);
      } else {
        renderTopbarAvatar(null);
      }
    }
    if (topbarHello && !signedIn) topbarHello.hidden = true;
    accountDescription.textContent = signedIn
      ? "Seus favoritos já estão sincronizados com a sua conta."
      : "Entre ou crie uma conta grátis para salvar seus favoritos.";
    if (signedIn) setAccountStatus("Conta conectada. Seus favoritos estão sincronizados.");
  }

  function renderTopbarAvatar(url: string | null): void {
    if (!topbarAccount) return;
    if (url && topbarAccountImage) {
      topbarAccountImage.src = url;
      topbarAccountImage.hidden = false;
      if (topbarAccountFallback) topbarAccountFallback.hidden = true;
      return;
    }
    if (topbarAccountImage) {
      topbarAccountImage.removeAttribute("src");
      topbarAccountImage.hidden = true;
    }
    if (topbarAccountFallback) topbarAccountFallback.hidden = false;
  }

  async function refreshTopbarAvatar(userId: string): Promise<void> {
    try {
      const { loadAvatar, avatarUrl } = await import("./avatar");
      const state = await loadAvatar(userId);
      renderTopbarAvatar(state.url ?? (state.path ? avatarUrl(state.path) : null));
    } catch (error) {
      console.warn("Could not load the topbar avatar.", error);
      renderTopbarAvatar(null);
    }
    try {
      const { loadDisplayName } = await import("./account");
      const name = await loadDisplayName(userId);
      if (topbarHello) {
        topbarHello.textContent = name ? `Olá, ${name}!` : "";
        topbarHello.hidden = !name;
      }
    } catch (error) {
      console.warn("Could not load the display name.", error);
      if (topbarHello) topbarHello.hidden = true;
    }
  }

  function likesByOffer(): Map<string, number> {
    return new Map([...reactionCounts].map(([offerId, counts]) => [offerId, counts.likes]));
  }

  async function loadAccountApi(): Promise<AccountApi> {
    accountApi ??= await import("./account");
    return accountApi;
  }

  async function loadReactionsApi(): Promise<ReactionsApi> {
    reactionsApi ??= await import("./offer-reactions");
    return reactionsApi;
  }

  let preferences: ProfilePreferences = {
    favoriteOfferIds: [...favoriteIds], favoriteStores: [], favoriteProductTypes: [], theme: "light",
  };

  async function saveFavoriteChanges(): Promise<void> {
    if (!currentUserId) return;
    try {
      const api = await loadAccountApi();
      preferences.favoriteOfferIds = [...favoriteIds];
      await api.savePreferences(currentUserId, preferences);
      setAccountStatus("Favoritos sincronizados.");
    } catch (error) {
      setAccountStatus(`Favoritos salvos. Sincronização falhou: ${errorMessage(error)}`);
    }
  }

  async function saveThemePreference(theme: ThemePreference): Promise<void> {
    if (!currentUserId) return;
    try {
      const api = await loadAccountApi();
      await api.savePreferences(currentUserId, preferences);
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
      const api = await loadAccountApi();
      const remotePreferences = await api.loadPreferences(userId);
      const guestFavorites = readGuestFavorites();
      preferences = {
        ...remotePreferences,
        favoriteOfferIds: [...new Set([...remotePreferences.favoriteOfferIds, ...guestFavorites])],
        theme: pendingTheme ?? remotePreferences.theme,
      };
      applyTheme(preferences.theme);
      favoriteIds = new Set(preferences.favoriteOfferIds);
      await api.savePreferences(userId, preferences);
      pendingTheme = null;
      preferencesLoaded = true;
      if (guestFavorites.size > 0) {
        try {
          localStorage.removeItem("feira-boa:favorites:v1");
        } catch {
          // The merged account copy is already saved; a leftover local key is harmless.
        }
      }
      try {
        const reactions = await loadReactionsApi();
        userReactions = await reactions.loadUserOfferReactions(userId);
      } catch (reactionError) {
        console.warn("Could not load saved offer reactions.", reactionError);
      }
      void refreshTopbarAvatar(userId);
      renderOffers();
      setAccountStatus("Conta conectada. Seus favoritos estão sincronizados.");
    } catch (error) {
      setAccountStatus(`Conta conectada. Não foi possível sincronizar preferências: ${errorMessage(error)}`);
    }
  }

  bindThemeToggle((theme) => {
    preferences.theme = theme;
    pendingTheme = theme;
    if (currentUserId && preferencesLoaded) void saveThemePreference(theme);
  });

  function money(value: number): string {
    return moneyFormatter.format(value);
  }

  function dateLabel(value: string): string {
    return dateFormatter.format(new Date(`${value}T12:00:00`)).replace(" de ", " ").replace(".", "");
  }

  function formatFeedUpdate(value: string): string {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "Atualização das ofertas indisponível";
    const day = feedDateFormatter.format(date).replace(/\./g, "");
    const time = feedTimeFormatter.format(date);
    return `Catálogo atualizado em ${day}, ${time}`;
  }

  function normalizeSearch(value: string): string {
    return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }

  function todayInSaoPaulo(): string {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${part.year}-${part.month}-${part.day}`;
  }

  function isActive(offer: Offer, today = todayInSaoPaulo()): boolean {
    return today >= offer.validFrom && today <= offer.validTo;
  }

  function matchesSearch(offer: Offer, query: string): boolean {
    const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const category = offerCategory(offer);
    const searchable = normalizeSearch([offer.name, offer.brand, offer.detail, offer.category, offer.department, ...offer.productTypes, category.subcategory, categoryLabel(category), offer.store, offer.branch, offer.note].join(" "));
    const words = searchable.split(" ");
    return terms.every((term) => {
      const variants = [term, ...(searchEquivalents[term] || [])];
      return variants.some((variant) => searchable.includes(variant) || words.some((word) => word.startsWith(variant)));
    });
  }

  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function heartIcon(): SVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z");
    svg.append(path);
    return svg;
  }

  function shareIcon(): SVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    for (const [cx, cy] of [["18", "5"], ["6", "12"], ["18", "19"]]) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", cx);
      circle.setAttribute("cy", cy);
      circle.setAttribute("r", "2.8");
      circle.setAttribute("fill", "currentColor");
      svg.append(circle);
    }
    for (const [x1, y1, x2, y2] of [["8.1", "10.8", "15.6", "6.4"], ["8.1", "13.2", "15.6", "17.6"]]) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("stroke", "currentColor");
      line.setAttribute("stroke-width", "1.8");
      line.setAttribute("stroke-linecap", "round");
      svg.append(line);
    }
    return svg;
  }

  function favoriteButton(offer: Offer, className: string): HTMLButtonElement {
    const button = element("button", className);
    button.type = "button";
    button.dataset.favoriteId = offer.id;
    button.append(heartIcon());
    return button;
  }

  function reactionButton(offer: Offer): { button: HTMLButtonElement; count: HTMLElement } {
    const button = element("button", "offer-reaction-button");
    button.type = "button";
    button.dataset.reaction = "like";
    button.dataset.offerId = offer.id;
    const icon = element("span", "", "👍");
    icon.setAttribute("aria-hidden", "true");
    const count = element("span", "", "0");
    button.append(icon, count);
    return { button, count };
  }

  function createOfferCard(offer: Offer): CardRefs {
    const root = element("article", "offer-card");
    root.dataset.offerId = offer.id;
    root.dataset.categoryRank = String(offerOrder(offer));

    const visual = element("div", "visual");
    const sticker = element("span", "offer-sticker", "OFERTA");
    const art = element("span", "product-art");
    art.setAttribute("role", "img");
    art.setAttribute("aria-label", `Ilustração de ${offer.name}`);
    const favoriteArt = favoriteButton(offer, "favorite-toggle favorite-toggle-art");
    visual.append(sticker, art, favoriteArt);

    const body = element("div", "card-body");
    const titleRow = element("div", "card-title");
    const name = element("h3");
    titleRow.append(name);
    const meta = element("div", "card-meta");
    const brand = element("span", "card-brand");
    const spec = element("span", "spec");
    meta.append(brand, spec);
    const info = element("div", "card-info");
    const priceRow = element("div", "price-row");
    const priceBlock = element("div", "price-block");
    const price = element("span", "price");
    const oldPrice = element("span", "old-price");
    const discount = element("span", "discount-badge");
    priceBlock.append(price, discount, oldPrice);
    const valid = element("span", "valid-until", "Válido");
    const validStrong = element("strong");
    valid.append(validStrong);
    priceRow.append(priceBlock, valid);

    const reactionGroup = element("div", "offer-reactions");
    reactionGroup.setAttribute("role", "group");
    reactionGroup.setAttribute("aria-label", "Esta oferta vale a pena?");
    const favoriteReaction = favoriteButton(offer, "favorite-toggle favorite-toggle-reaction");
    const like = reactionButton(offer);
    reactionGroup.append(favoriteReaction, like.button);

    const note = element("p", "offer-note");
    const source = element("div", "card-source");
    const branch = element("span");
    const sourceLink = element("a");
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener";
    sourceLink.textContent = "ver oferta";
    const share = element("button", "share-offer");
    share.type = "button";
    share.dataset.shareId = offer.id;
    share.append(shareIcon());
    source.append(branch, document.createTextNode(" · "), sourceLink, share);

    body.append(titleRow, meta, info, priceRow, reactionGroup, note, source);
    root.append(visual, body);

    const refs: CardRefs = {
      root, art, name, brand, spec, info, price, oldPrice, discount, valid: validStrong, note, branch,
      sourceLink, share, favoriteButtons: [favoriteArt, favoriteReaction],
      like: like.button, likeCount: like.count,
    };
    updateOfferCard(refs, offer);
    return refs;
  }

  function updateOfferCard(refs: CardRefs, offer: Offer): void {
    refs.art.textContent = offer.icon;
    refs.art.setAttribute("aria-label", `Ilustração de ${offer.name}`);
    refs.name.textContent = offer.name;
    const category = offerCategory(offer);
    refs.info.textContent = [category.subcategory, offer.store].filter(Boolean).join(" · ");
    refs.brand.textContent = offer.brand;
    refs.brand.hidden = !offer.brand;
    refs.spec.textContent = offer.detail;
    refs.spec.hidden = !offer.detail;
    refs.price.textContent = money(offer.price);
    const discountPercent = offer.previousPrice && offer.previousPrice > offer.price
      ? Math.round((1 - offer.price / offer.previousPrice) * 100)
      : 0;
    refs.oldPrice.textContent = offer.previousPrice ? money(offer.previousPrice) : "";
    refs.oldPrice.hidden = true;
    refs.discount.textContent = discountPercent > 0 ? `-${discountPercent}%` : "";
    refs.discount.hidden = discountPercent <= 0;
    if (discountPercent > 0) {
      refs.discount.title = `De ${money(offer.previousPrice!)} por ${money(offer.price)}`;
      refs.discount.setAttribute("aria-label", `Desconto de ${discountPercent} por cento, de ${money(offer.previousPrice!)} por ${money(offer.price)}`);
    } else {
      refs.discount.removeAttribute("title");
      refs.discount.removeAttribute("aria-label");
    }
    refs.valid.textContent = `${dateLabel(offer.validFrom)}–${dateLabel(offer.validTo)}`;
    refs.note.textContent = offer.note;
    refs.note.hidden = !offer.note;
    refs.branch.textContent = offer.branch;
    refs.sourceLink.href = /^https:\/\//.test(offer.sourceUrl) ? offer.sourceUrl : "#";
    refs.share.setAttribute("aria-label", `Compartilhar ${offer.name}`);
    refs.share.title = `Compartilhar ${offer.name}`;

    const favoriteLabel = favoriteIds.has(offer.id) ? "Remover dos favoritos" : "Adicionar aos favoritos";
    for (const button of refs.favoriteButtons) {
      button.setAttribute("aria-pressed", String(favoriteIds.has(offer.id)));
      button.setAttribute("aria-label", favoriteLabel);
    }

    const counts = reactionCounts.get(offer.id) ?? { likes: 0, dislikes: 0 };
    const currentReaction = userReactions.get(offer.id);
    refs.like.classList.toggle("selected", currentReaction === "like");
    refs.like.setAttribute("aria-pressed", String(currentReaction === "like"));
    refs.like.setAttribute("aria-label", `Gostei desta oferta, ${counts.likes} votos`);
    refs.like.title = currentUserId ? "Gostei" : "Entre para avaliar e salvar seu voto";
    if (currentUserId) refs.like.removeAttribute("aria-haspopup");
    else refs.like.setAttribute("aria-haspopup", "dialog");
    refs.likeCount.textContent = String(counts.likes);
  }

  function renderStoreFilters(): void {
    const today = todayInSaoPaulo();
    const counts = new Map<string, number>();
    let total = 0;
    for (const offer of offers) {
      if (!isActive(offer, today)) continue;
      total += 1;
      counts.set(offer.store, (counts.get(offer.store) ?? 0) + 1);
    }
    const ordered = [...storeNames].sort((a, b) => {
      if (a === "Todas as lojas") return -1;
      if (b === "Todas as lojas") return 1;
      return (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    });
    storeFilters.replaceChildren(...ordered.map((store) => {
      const count = store === "Todas as lojas" ? total : (counts.get(store) ?? 0);
      const disabled = store !== "Todas as lojas" && count === 0;
      const button = element("button", `filter${store === activeStore ? " active" : ""}`, `${store} · ${count}`);
      button.type = "button";
      button.dataset.store = store;
      button.disabled = disabled;
      button.setAttribute("aria-pressed", String(store === activeStore));
      if (disabled) button.title = "Sem ofertas ativas hoje";
      return button;
    }));
  }

  function renderPopularItems(): void {
    const today = todayInSaoPaulo();
    const counts = new Map<string, number>();
    for (const offer of offers) {
      if (!isActive(offer, today)) continue;
      const category = offerCategory(offer);
      const key = category.subcategory;
      counts.set(category.groupId, (counts.get(category.groupId) ?? 0) + 1);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const quickSorts = [
      { id: "top-rated", label: "Mais curtidos", icon: "👍" },
      { id: "discount", label: "Maiores descontos", icon: "🏷️" },
    ];
    const featured: Array<{ id: string; label: string; icon: string }> = [
      { id: "carnes", label: "Carnes", icon: "🥩" },
      { id: "bebidas", label: "Bebidas", icon: "🥤" },
    ];
    const rest = RANDOM_CATEGORY_ORDER
      .filter((groupId) => groupId !== "bebidas" && groupId !== "outros" && (counts.get(groupId) ?? 0) > 0)
      .map((groupId) => {
        const group = TAXONOMY_GROUPS.find((item) => item.id === groupId)!;
        return { id: group.id, label: group.label, icon: CATEGORY_ICONS[group.id] ?? "🛒" };
      });
    popularItems.replaceChildren(...quickSorts.map(({ id, label, icon }) => {
      const button = element("button", `popular-item quick-sort${sortSelect.value === id ? " active" : ""}`);
      button.type = "button";
      button.dataset.quickSort = id;
      button.setAttribute("aria-label", `Mostrar somente ${label.toLowerCase()}`);
      button.setAttribute("aria-pressed", String(sortSelect.value === id));
      const iconNode = element("span", "", icon);
      iconNode.setAttribute("aria-hidden", "true");
      button.append(iconNode, element("small", "", label));
      return button;
    }), ...[...featured, ...rest].map(({ id, label, icon }) => {
      const button = element("button", `popular-item${activeDepartment === id ? " active" : ""}`);
      button.type = "button";
      button.dataset.group = id;
      button.setAttribute("aria-label", `Ver ${label}`);
      button.setAttribute("aria-pressed", String(activeDepartment === id));
      const iconNode = element("span", "", icon);
      iconNode.setAttribute("aria-hidden", "true");
      button.append(iconNode, element("small", "", label));
      return button;
    }));
  }

  function matchesSector(category: { groupId: string; subcategory: string }): boolean {
    if (!activeDepartment) return true;
    if (activeDepartment === "carnes") return CARNES_SUBCATEGORIES.has(category.subcategory);
    return category.groupId === activeDepartment;
  }

  function updateProductTypeOptions(): void {
    const today = todayInSaoPaulo();
    const options = new Map<string, number>();
    for (const offer of offers) {
      if (!isActive(offer, today)) continue;
      if (activeStore !== "Todas as lojas" && offer.store !== activeStore) continue;
      const category = offerCategory(offer);
      if (!matchesSector(category)) continue;
      if (!options.has(category.subcategory)) options.set(category.subcategory, offerOrder(offer));
    }
    const types = [...options.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "pt-BR")).map(([type]) => type);
    if (!types.includes(activeProductType)) activeProductType = "";
    productTypeSelect.replaceChildren(
      new Option("Todos os tipos", ""),
      ...types.map((type) => new Option(type, type)),
    );
    productTypeSelect.value = activeProductType;
  }

  function renderFilters(): void {
    const today = todayInSaoPaulo();
    const counts = new Map<string, number>();
    for (const offer of offers) {
      if (!isActive(offer, today)) continue;
      const groupId = offerCategory(offer).groupId;
      counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
    }
    const sectors = [{ id: "", label: ALL_SECTORS_LABEL, count: offers.filter((offer) => isActive(offer, today)).length }, ...TAXONOMY_GROUPS.map((group) => ({ id: group.id, label: group.label, count: counts.get(group.id) ?? 0 }))];
    filters.replaceChildren(...sectors.map((sector) => {
      const disabled = sector.id !== "" && sector.count === 0;
      const button = element("button", `filter${sector.id === activeDepartment ? " active" : ""}`, `${sector.label} · ${sector.count}`);
      button.type = "button";
      button.dataset.department = sector.id;
      button.disabled = disabled;
      button.setAttribute("aria-pressed", String(sector.id === activeDepartment));
      if (disabled) button.title = "Sem ofertas ativas hoje";
      return button;
    }));
    updateProductTypeOptions();
  }

  function updateFilterStates(container: HTMLElement, key: "store" | "department", value: string): void {
    container.querySelectorAll<HTMLButtonElement>(`[data-${key}]`).forEach((button) => {
      const selected = button.dataset[key] === value;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function getPriceBounds(): { min: number | null; max: number | null } {
    const min = priceMin.value.trim() ? Number(priceMin.value.replace(",", ".")) : null;
    const max = priceMax.value.trim() ? Number(priceMax.value.replace(",", ".")) : null;
    return { min: min !== null && Number.isFinite(min) ? min : null, max: max !== null && Number.isFinite(max) ? max : null };
  }

  function renderOffers(): void {
    const focused = document.activeElement instanceof HTMLElement && grid.contains(document.activeElement)
      ? document.activeElement
      : null;
    const today = todayInSaoPaulo();
    const { min, max } = getPriceBounds();
    const activeCount = Number(activeStore !== "Todas as lojas") + Number(Boolean(activeDepartment)) + Number(Boolean(activeProductType)) + Number(min !== null || max !== null);
    activeFilterCount.hidden = activeCount === 0;
    activeFilterCount.textContent = String(activeCount);
    const priceRangeReversed = min !== null && max !== null && min > max;
    const likes = likesByOffer();
    let matching = priceRangeReversed ? [] : offers.filter((offer) => {
      const category = offerCategory(offer);
      const matchesSectorFilter = matchesSector(category);
      const matchesReaction = sortSelect.value === "top-rated" ? (likes.get(offer.id) ?? 0) > 0 : true;
      const matchesDiscount = sortSelect.value === "discount" ? discountRatio(offer) > 0 : true;
      return (sharedOfferId ? offer.id === sharedOfferId : isActive(offer, today)) && (sharedOfferId || activeStore === "Todas as lojas" || offer.store === activeStore) &&
      (sharedOfferId || matchesSectorFilter) &&
      (sharedOfferId || !activeProductType || category.subcategory === activeProductType) &&
      (sharedOfferId || !favoriteOnly || favoriteIds.has(offer.id)) &&
      (sharedOfferId || matchesReaction) && (sharedOfferId || matchesDiscount) &&
      (sharedOfferId || min === null || offer.price >= min) && (sharedOfferId || max === null || offer.price <= max) && (sharedOfferId || matchesSearch(offer, input.value));
    });
    if (sortSelect.value === "recommended") matching = [...matching].sort((a, b) => offerOrder(a) - offerOrder(b));
    if (sortSelect.value === "price-low") matching = [...matching].sort((a, b) => a.price - b.price);
    if (sortSelect.value === "price-high") matching = [...matching].sort((a, b) => b.price - a.price);
    if (sortSelect.value === "discount") matching = [...matching].sort((a, b) => discountRatio(b) - discountRatio(a));
    if (sortSelect.value === "top-rated") {
      matching = [...matching].sort((a, b) => (likes.get(b.id) ?? 0) - (likes.get(a.id) ?? 0));
    }

    const matchingIds = new Set(matching.map((offer) => offer.id));
    for (const [id, card] of cards) {
      if (!matchingIds.has(id)) {
        card.root.remove();
        cards.delete(id);
      }
    }
    for (const offer of matching) {
      let card = cards.get(offer.id);
      if (!card) {
        card = createOfferCard(offer);
        cards.set(offer.id, card);
      }
      updateOfferCard(card, offer);
      grid.append(card.root);
    }
    if (matching.length === 0) grid.replaceChildren();
    if (focused?.isConnected) focused.focus({ preventScroll: true });

    feedStatus.hidden = true;
    feedRetry.hidden = true;
    emptyState.hidden = matching.length > 0;
    storesDirectoryLink.hidden = matching.length === 0;
    const activeFavoriteCount = offers.filter((offer) => isActive(offer, today) && favoriteIds.has(offer.id)).length;
    favoritesToggle.textContent = favoriteOnly ? `Ver todas (${activeFavoriteCount})` : `Favoritos (${activeFavoriteCount})`;
    favoritesToggle.setAttribute("aria-pressed", String(favoriteOnly));
    resultsTitle.textContent = sharedOfferId ? "Oferta compartilhada" : "Ofertas encontradas";
    showAllOffersButton.hidden = !sharedOfferId;
    const storeLabel = activeStore === "Todas as lojas" ? "todas as lojas" : activeStore;
    const sectorLabel = activeDepartment ? TAXONOMY_GROUPS.find((group) => group.id === activeDepartment)?.label ?? "" : "";
    const sharedOffer = sharedOfferId ? matching[0] : null;
    resultsSubtitle.textContent = sharedOffer
      ? `${sharedOffer.name} · ${money(sharedOffer.price)} · ${sharedOffer.store}${isActive(sharedOffer, today) ? "" : " · oferta encerrada"}`
      : `${matching.length} ${matching.length === 1 ? "oferta ativa" : "ofertas ativas"} · ${storeLabel}${sectorLabel ? ` · ${sectorLabel}` : ""}${activeProductType ? ` · ${activeProductType}` : ""}`;
    if (priceRangeReversed) emptyHelp.textContent = "O preço mínimo precisa ser menor ou igual ao preço máximo.";
    else if (offers.some((offer) => isActive(offer, today))) emptyHelp.textContent = "Não encontramos ofertas com essa busca e esses filtros. Tente outra palavra ou limpe os filtros.";
    else emptyHelp.textContent = "Não há ofertas ativas hoje. Consulte os folhetos abaixo para ver as promoções mais recentes.";
    const announcement = `${matching.length} ${matching.length === 1 ? "oferta encontrada" : "ofertas encontradas"}`;
    if (resultsAnnouncement.textContent !== announcement) {
      resultsAnnouncement.textContent = "";
      window.requestAnimationFrame(() => { resultsAnnouncement.textContent = announcement; });
    }
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
    const title = `${offer.icon} ${offer.name} por ${money(offer.price)} · Feira Boa`;
    const text = `${offer.icon} ${offer.name} por ${money(offer.price)} no ${offer.store}. Confira a oferta:`;
    const shareMessage = `${text}\n${url}`;
    button.disabled = true;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        showTransientStatus(shareStatus, "Oferta compartilhada.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareMessage);
        showTransientStatus(shareStatus, "Mensagem da oferta copiada.");
      } else {
        window.prompt("Copie a mensagem para compartilhar esta oferta:", shareMessage);
        showTransientStatus(shareStatus, "Mensagem da oferta pronta para copiar.");
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
    if (!offers.some((offer) => offer.id === offerId)) return;

    if (!currentUserId) {
      askForLogin(button, "reaction");
      return;
    }

    button.disabled = true;
    try {
      const reactions = await loadReactionsApi();
      const previousReaction = userReactions.get(offerId);
      const counts = { ...(reactionCounts.get(offerId) ?? { likes: 0, dislikes: 0 }) };

      if (previousReaction === reaction) {
        await reactions.deleteOfferReaction(currentUserId, offerId);
        userReactions.delete(offerId);
        counts[reaction === "like" ? "likes" : "dislikes"] = Math.max(0, counts[reaction === "like" ? "likes" : "dislikes"] - 1);
        reactionCounts.set(offerId, counts);
        showTransientStatus(shareStatus, "Sua avaliação foi removida.");
      } else {
        await reactions.saveOfferReaction(currentUserId, offerId, reaction);
        userReactions.set(offerId, reaction);
        if (previousReaction && previousReaction !== reaction) {
          counts[previousReaction === "like" ? "likes" : "dislikes"] = Math.max(0, counts[previousReaction === "like" ? "likes" : "dislikes"] - 1);
        }
        counts[reaction === "like" ? "likes" : "dislikes"] += 1;
        reactionCounts.set(offerId, counts);
        showTransientStatus(shareStatus, "Sua avaliação foi salva.");
      }

      reactionCounts = await reactions.loadOfferReactionCounts();
      renderOffers();
    } catch (error) {
      showTransientStatus(shareStatus, `Não foi possível salvar sua avaliação: ${errorMessage(error)}`);
    } finally {
      button.disabled = false;
    }
  });

  grid.addEventListener("click", (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-favorite-id]");
    const offerId = button?.dataset.favoriteId;
    if (!offerId) return;
    if (!currentUserId) {
      askForLogin(button, "favorite");
      return;
    }
    if (favoriteIds.has(offerId)) favoriteIds.delete(offerId);
    else favoriteIds.add(offerId);
    preferences.favoriteOfferIds = [...favoriteIds];
    renderOffers();
    void saveFavoriteChanges();
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
    if (!button || button.disabled) return;
    activeStore = button.dataset.store ?? "Todas as lojas";
    updateFilterStates(storeFilters, "store", activeStore);
    updateProductTypeOptions();
    renderPopularItems();
    renderOffers();
  });

  popularItems.addEventListener("click", (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const quickSort = target.closest<HTMLButtonElement>("[data-quick-sort]");
    if (quickSort) {
      sortSelect.value = quickSort.dataset.quickSort ?? "recommended";
      activeDepartment = "";
      activeProductType = "";
      updateFilterStates(filters, "department", activeDepartment);
      updateProductTypeOptions();
      renderPopularItems();
      renderOffers();
      return;
    }
    const group = target.closest<HTMLButtonElement>("[data-group]");
    if (!group) return;
    activeDepartment = group.dataset.group ?? "";
    activeProductType = "";
    sortSelect.value = "recommended";
    updateFilterStates(filters, "department", activeDepartment);
    updateProductTypeOptions();
    renderPopularItems();
    renderOffers();
    resultsTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  filters.addEventListener("click", (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-department]");
    if (!button || button.disabled) return;
    activeDepartment = button.dataset.department ?? "";
    activeProductType = "";
    updateFilterStates(filters, "department", activeDepartment);
    updateProductTypeOptions();
    renderOffers();
  });

  let renderTimer: number | undefined;
  function scheduleRender(): void {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderOffers, 150);
  }

  input.addEventListener("input", scheduleRender);
  priceMin.addEventListener("input", scheduleRender);
  priceMax.addEventListener("input", scheduleRender);
  productTypeSelect.addEventListener("change", () => { activeProductType = productTypeSelect.value; renderOffers(); });
  sortSelect.addEventListener("change", () => { renderPopularItems(); renderOffers(); });
  resetButton.addEventListener("click", () => {
    activeStore = "Todas as lojas"; activeDepartment = ""; activeProductType = "";
    input.value = ""; priceMin.value = ""; priceMax.value = ""; sortSelect.value = "recommended";
    updateFilterStates(storeFilters, "store", activeStore);
    updateFilterStates(filters, "department", activeDepartment);
    updateProductTypeOptions();
    renderPopularItems();
    renderOffers();
    input.focus();
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
  for (const favoritesLink of [navFavoritesLink, mobileNavFavoritesLink]) {
    favoritesLink.addEventListener("click", (event: MouseEvent) => {
      if (currentUserId) return;
      event.preventDefault();
      askForLogin(favoritesLink, "favorite");
    });
  }

  function setFavoritesView(active: boolean): void {
    favoriteOnly = active;
    if (active) {
      navFavoritesLink.setAttribute("aria-current", "page");
      mobileNavFavoritesLink.setAttribute("aria-current", "page");
      mobileNavOffersLink.removeAttribute("aria-current");
    } else {
      navFavoritesLink.removeAttribute("aria-current");
      mobileNavFavoritesLink.removeAttribute("aria-current");
      mobileNavOffersLink.setAttribute("aria-current", "page");
    }
    renderOffers();
  }

  favoritesToggle.addEventListener("click", () => {
    if (!currentUserId) {
      askForLogin(favoritesToggle, "favorite");
      return;
    }
    setFavoritesView(!favoriteOnly);
  });
  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
    if (event.key === "/") {
      event.preventDefault();
      input.focus();
    }
  });

  updateViewMode();
  renderStoreFilters();
  renderPopularItems();
  renderFilters();
  renderOffers();
  applySourceFreshness();
  updatedLabel.textContent = formatFeedUpdate(feed.updatedAt);
  updatedLabel.title = "Data da última atualização do catálogo de ofertas";

  void (async () => {
    try {
      const reactions = await loadReactionsApi();
      reactionCounts = await reactions.loadOfferReactionCounts();
      renderPopularItems();
      renderOffers();
    } catch (error) {
      console.warn("Could not load offer reaction totals.", error);
    }
  })();

  void (async () => {
    try {
      const api = await loadAccountApi();
      const user = await api.getCurrentUser();
      if (user) await connectAccount(user.id);
      else {
        setAccountStatus("Entre na sua conta para salvar seus favoritos e tê-los em qualquer dispositivo.");
        if (favoriteOnly) {
          askForLogin(favoritesToggle, "favorite", () => {
            if (currentUserId) return;
            setFavoritesView(false);
            const url = new URL(window.location.href);
            if (url.searchParams.get("view") === "favorites") {
              url.searchParams.delete("view");
              window.history.replaceState({}, "", url);
            }
          });
        }
      }
    } catch (error) {
      setAccountStatus(`Conta temporariamente indisponível: ${errorMessage(error)}`);
    }
  })();
})().catch((error: unknown) => {
  console.error("Feira Boa could not load offers.", error);
  showFeedError();
});
