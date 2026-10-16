interface Offer {
  store: string; storeLogo: string; branch: string; name: string; brand: string; detail: string;
  category: string; department: string; productType: string; price: number; previousPrice: number | null;
  icon: string; tone: string; note: string; validFrom: string; validTo: string; source: string; sourceUrl: string;
}
interface Window { FEIRA_OFFERS: Offer[]; FEIRA_SOURCE_ALERTS?: Array<{ url: string; message: string }> }

const offers = window.FEIRA_OFFERS || [];
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
const emptyHelp = document.querySelector<HTMLSpanElement>("#empty-help")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset-filters")!;
let activeDepartment = "Todos os setores";
let activeStore = "Todas as lojas";
let activeProductType = "";

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
  const priceRangeReversed = min !== null && max !== null && min > max;
  let matching = priceRangeReversed ? [] : offers.filter((offer) =>
    isActive(offer) && (activeStore === "Todas as lojas" || offer.store === activeStore) &&
    (activeDepartment === "Todos os setores" || offer.department === activeDepartment) &&
    (!activeProductType || offer.productType === activeProductType) &&
    (min === null || offer.price >= min) && (max === null || offer.price <= max) && matchesSearch(offer, input.value)
  );
  if (sortSelect.value === "price-low") matching = matching.sort((a, b) => a.price - b.price);
  if (sortSelect.value === "price-high") matching = matching.sort((a, b) => b.price - a.price);
  if (sortSelect.value === "discount") matching = matching.sort((a, b) => ((b.previousPrice ?? b.price) - b.price) - ((a.previousPrice ?? a.price) - a.price));

  grid.innerHTML = matching.map((offer) => `
    <article class="offer-card">
      <div class="visual" style="--tone:${offer.tone}"><span class="product-art" role="img" aria-label="Ilustração de ${offer.name}">${offer.icon}</span><span class="offer-sticker">OFERTA</span></div>
      <div class="card-body"><div class="offer-store"><span class="offer-store-logo ${offer.store === "Big Bom" ? "bigbom-mark" : ""}">${offer.storeLogo ? `<img src="${offer.storeLogo}" alt="${offer.store}" loading="lazy" onerror="this.parentElement.classList.add('logo-fallback');this.remove()">` : offer.store.slice(0,2)}</span><span class="category">${offer.productType} · ${offer.store}</span></div><h3>${offer.name}</h3><span class="spec">${offer.brand ? `${offer.brand} · ` : ""}${offer.detail}</span>
        <div class="price-row"><div><span class="price">${money(offer.price)}</span>${offer.previousPrice ? `<span class="old-price">${money(offer.previousPrice)}</span>` : ""}</div><span class="valid-until">Válido<strong>${dateLabel(offer.validFrom)}–${dateLabel(offer.validTo)}</strong></span></div>
        ${offer.note ? `<p class="offer-note">${offer.note}</p>` : ""}
        <div class="card-source"><span class="source-dot"></span>${offer.branch} · <a href="${offer.sourceUrl}" target="_blank" rel="noopener">ver oferta</a></div>
      </div>
    </article>`).join("");
  emptyState.hidden = matching.length > 0;
  const storeLabel = activeStore === "Todas as lojas" ? "todas as lojas" : activeStore;
  resultsSubtitle.textContent = `${matching.length} ${matching.length === 1 ? "oferta ativa" : "ofertas ativas"} · ${storeLabel}${activeDepartment === "Todos os setores" ? "" : ` · ${activeDepartment}`}${activeProductType ? ` · ${activeProductType}` : ""}`;
  if (priceRangeReversed) emptyHelp.textContent = "O preço mínimo precisa ser menor ou igual ao preço máximo.";
  else if (offers.some(isActive)) emptyHelp.textContent = "Não encontramos ofertas com essa busca e esses filtros. Tente outra palavra ou limpe os filtros.";
  else emptyHelp.textContent = "Não há ofertas ativas hoje. Consulte os folhetos abaixo para ver as promoções mais recentes.";
}

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
document.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "/" && document.activeElement !== input) { event.preventDefault(); input.focus(); }
});

const sourceAlerts = window.FEIRA_SOURCE_ALERTS || [];
document.querySelector<HTMLSpanElement>("#updated-label")!.textContent = sourceAlerts.length
  ? `${sourceAlerts.length} fonte(s) mudou(aram) · ofertas aguardam conferência`
  : "Ofertas dos encartes oficiais · fontes monitoradas diariamente";
renderStoreFilters(); renderPopularItems(); renderFilters(); renderOffers();
