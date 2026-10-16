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
let activeCategory = "Todas";
let activeStore = "Todas as lojas";
const commonItems = [
  {label:"Café", icon:"☕", query:"café"},
  {label:"Leite", icon:"🥛", query:"leite"},
  {label:"Arroz", icon:"🍚", query:"arroz"},
  {label:"Frango", icon:"🍗", query:"frango"},
  {label:"Carne", icon:"🥩", query:"bovino"},
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

function isActive(offer) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = new Date(`${offer.validFrom}T00:00:00`);
  const to = new Date(`${offer.validTo}T23:59:59`);
  return today >= from && today <= to;
}

function renderStoreFilters() {
  storeFilters.innerHTML = storeNames.map((store) =>
    `<button class="filter ${store === activeStore ? "active" : ""}" type="button" data-store="${store}">${store}</button>`
  ).join("");
}

function renderPopularItems() {
  popularItems.innerHTML = commonItems.map(({label, icon, query}) =>
    `<button class="popular-item" type="button" data-query="${query}" aria-label="Buscar ${label}"><span aria-hidden="true">${icon}</span><small>${label}</small></button>`
  ).join("");
}

function renderFilters() {
  filters.innerHTML = categories.map((category) =>
    `<button class="filter ${category === activeCategory ? "active" : ""}" type="button" data-category="${category}">${category}</button>`
  ).join("");
}

function renderOffers() {
  const query = input.value.trim().toLocaleLowerCase("pt-BR");
  const matching = offers.filter((offer) => {
    const searchable = `${offer.name} ${offer.brand} ${offer.detail} ${offer.category} ${offer.store} ${offer.branch}`.toLocaleLowerCase("pt-BR");
    return isActive(offer) && (activeStore === "Todas as lojas" || offer.store === activeStore) &&
      (activeCategory === "Todas" || offer.category === activeCategory) && (!query || searchable.includes(query));
  });
  grid.innerHTML = matching.map((offer) => `
    <article class="offer-card">
      <div class="visual" style="--tone:${offer.tone}"><span class="product-art" role="img" aria-label="Ilustração de ${offer.name}">${offer.icon}</span><span class="offer-sticker">OFERTA</span></div>
      <div class="card-body"><span class="category">${offer.category} · ${offer.store}</span><h3>${offer.name}</h3><span class="spec">${offer.brand ? `${offer.brand} · ` : ""}${offer.detail}</span>
        <div class="price-row"><div><span class="price">${money(offer.price)}</span>${offer.previousPrice ? `<span class="old-price">${money(offer.previousPrice)}</span>` : ""}</div><span class="valid-until">Válido<strong>${dateLabel(offer.validFrom)}–${dateLabel(offer.validTo)}</strong></span></div>
        ${offer.note ? `<p class="offer-note">${offer.note}</p>` : ""}
        <div class="card-source"><span class="source-dot"></span>${offer.branch} · <a href="${offer.sourceUrl}" target="_blank" rel="noopener">ver oferta</a></div>
      </div>
    </article>`).join("");
  emptyState.hidden = matching.length > 0;
  const storeLabel = activeStore === "Todas as lojas" ? "todas as lojas" : activeStore;
  resultsSubtitle.textContent = `${matching.length} ${matching.length === 1 ? "oferta ativa" : "ofertas ativas"} · ${storeLabel}`;
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
