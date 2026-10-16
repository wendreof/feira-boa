const offers = window.FEIRA_OFFERS || [];
const storeNames = ["Todas as lojas", ...new Set(offers.map((offer) => offer.store))];
const categories = ["Todas", ...new Set(offers.map((offer) => offer.category))];
const grid = document.querySelector("#offer-grid");
const filters = document.querySelector("#filters");
const storeFilters = document.querySelector("#store-filters");
const popularItems = document.querySelector("#popular-items");
const input = document.querySelector("#search-input");
const emptyState = document.querySelector("#empty-state");
const resultsSubtitle = document.querySelector("#results-subtitle");
const emptyHelp = document.querySelector("#empty-help");
const resetButton = document.querySelector("#reset-filters");
let activeCategory = "Todas";
let activeStore = "Todas as lojas";
const searchEquivalents = { iogurte: ["iog"], higienico: ["hig"], higienica: ["hig"] };
const commonItems = [
  {label:"Café", icon:"☕", query:"café"},
  {label:"Leite", icon:"🥛", query:"leite"},
  {label:"Arroz", icon:"🍚", query:"arroz"},
  {label:"Frango", icon:"🍗", query:"frango"},
  {label:"Carne", icon:"🥩", query:"carne"},
  {label:"Tomate", icon:"🍅", query:"tomate"},
  {label:"Cerveja", icon:"🍺", query:"cerveja"},
  {label:"Sabão", icon:"🧺", query:"sabão"},
  {label:"Papel higiênico", icon:"🧻", query:"papel higiênico"},
  {label:"Iogurte", icon:"🥣", query:"iogurte"}
];

function money(value) {
  return new Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"}).format(value);
}

function dateLabel(value) {
  return new Intl.DateTimeFormat("pt-BR", {day:"2-digit", month:"short"})
    .format(new Date(`${value}T12:00:00`)).replace(" de ", " ").replace(".", "");
}

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = Object.fromEntries(parts.map(({type, value}) => [type, value]));
  return `${part.year}-${part.month}-${part.day}`;
}

function isActive(offer) {
  const today = todayInSaoPaulo();
  return today >= offer.validFrom && today <= offer.validTo;
}

function matchesSearch(offer, query) {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const searchable = normalizeSearch([
    offer.name, offer.brand, offer.detail, offer.category, offer.store,
    offer.branch, offer.note
  ].join(" "));
  const words = searchable.split(" ");
  return terms.every((term) => {
    const variants = [term, ...(searchEquivalents[term] || [])];
    return variants.some((variant) => searchable.includes(variant) || words.some((word) => word.startsWith(variant)));
  });
}

function renderStoreFilters() {
  storeFilters.innerHTML = storeNames.map((store) => {
    const count = store === "Todas as lojas"
      ? offers.filter(isActive).length
      : offers.filter((offer) => offer.store === store && isActive(offer)).length;
    const disabled = store !== "Todas as lojas" && count === 0;
    const label = `${store} · ${count}`;
    return `<button class="filter ${store === activeStore ? "active" : ""}" type="button" data-store="${store}"${disabled ? " disabled title=\"Sem ofertas ativas hoje\"" : ""}>${label}</button>`;
  }).join("");
}

function renderPopularItems() {
  popularItems.innerHTML = commonItems.map(({label, icon, query}) =>
    `<button class="popular-item" type="button" data-query="${query}" aria-label="Buscar ${label}"><span aria-hidden="true">${icon}</span><small>${label}</small></button>`
  ).join("");
}

function renderFilters() {
  filters.innerHTML = categories.map((category) => {
    const count = category === "Todas"
      ? offers.filter(isActive).length
      : offers.filter((offer) => offer.category === category && isActive(offer)).length;
    const disabled = category !== "Todas" && count === 0;
    return `<button class="filter ${category === activeCategory ? "active" : ""}" type="button" data-category="${category}"${disabled ? " disabled title=\"Sem ofertas ativas hoje\"" : ""}>${category} · ${count}</button>`;
  }).join("");
}

function renderOffers() {
  const query = input.value;
  const matching = offers.filter((offer) => {
    return isActive(offer) && (activeStore === "Todas as lojas" || offer.store === activeStore) &&
      (activeCategory === "Todas" || offer.category === activeCategory) && matchesSearch(offer, query);
  });
  grid.innerHTML = matching.map((offer) => `
    <article class="offer-card">
      <div class="visual" style="--tone:${offer.tone}"><span class="product-art" role="img" aria-label="Ilustração de ${offer.name}">${offer.icon}</span><span class="offer-sticker">OFERTA</span></div>
      <div class="card-body"><div class="offer-store"><span class="offer-store-logo ${offer.store === "Big Bom" ? "bigbom-mark" : ""}">${offer.storeLogo ? `<img src="${offer.storeLogo}" alt="${offer.store}" loading="lazy" onerror="this.parentElement.classList.add('logo-fallback');this.remove()">` : offer.store.slice(0,2)}</span><span class="category">${offer.category} · ${offer.store}</span></div><h3>${offer.name}</h3><span class="spec">${offer.brand ? `${offer.brand} · ` : ""}${offer.detail}</span>
        <div class="price-row"><div><span class="price">${money(offer.price)}</span>${offer.previousPrice ? `<span class="old-price">${money(offer.previousPrice)}</span>` : ""}</div><span class="valid-until">Válido<strong>${dateLabel(offer.validFrom)}–${dateLabel(offer.validTo)}</strong></span></div>
        ${offer.note ? `<p class="offer-note">${offer.note}</p>` : ""}
        <div class="card-source"><span class="source-dot"></span>${offer.branch} · <a href="${offer.sourceUrl}" target="_blank" rel="noopener">ver oferta</a></div>
      </div>
    </article>`).join("");
  emptyState.hidden = matching.length > 0;
  const storeLabel = activeStore === "Todas as lojas" ? "todas as lojas" : activeStore;
  resultsSubtitle.textContent = `${matching.length} ${matching.length === 1 ? "oferta ativa" : "ofertas ativas"} · ${storeLabel}${activeCategory === "Todas" ? "" : ` · ${activeCategory}`}`;
  if (emptyHelp) emptyHelp.textContent = offers.some(isActive)
    ? "Não encontramos ofertas com essa busca e esses filtros. Tente outra palavra ou limpe os filtros."
    : "Não há ofertas ativas hoje. Consulte os folhetos abaixo para ver as promoções mais recentes.";
}

storeFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-store]");
  if (!button) return;
  activeStore = button.dataset.store;
  renderStoreFilters();
  renderOffers();
});
popularItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-query]");
  if (!button) return;
  input.value = button.dataset.query;
  renderOffers();
  input.focus();
});
filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderFilters();
  renderOffers();
});
input.addEventListener("input", renderOffers);
if (resetButton) resetButton.addEventListener("click", () => {
  activeStore = "Todas as lojas";
  activeCategory = "Todas";
  input.value = "";
  renderStoreFilters();
  renderFilters();
  renderOffers();
  input.focus();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== input) {
    event.preventDefault();
    input.focus();
  }
});

const sourceAlerts = window.FEIRA_SOURCE_ALERTS || [];
document.querySelector("#updated-label").textContent = sourceAlerts.length
  ? `${sourceAlerts.length} fonte(s) mudou(aram) · ofertas aguardam conferência`
  : "Ofertas dos encartes oficiais · fontes monitoradas diariamente";
renderStoreFilters();
renderPopularItems();
renderFilters();
renderOffers();


