const offers = [
  {name:"Leite integral Italac", brand:"Italac", detail:"1 litro", category:"Laticínios", price:4.79, icon:"🥛", tone:"#e8f1fc", valid:"16–17 out", source:"Folheto oficial · Durval Nicolau"},
  {name:"Refrigerante Coca-Cola", brand:"Coca-Cola", detail:"Garrafa PET · 2 litros", category:"Bebidas", price:9.99, icon:"🥤", tone:"#fff0e9", valid:"16–17 out", source:"Folheto oficial · Durval Nicolau"},
  {name:"Produto Vigor", brand:"Vigor", detail:"Oferta do encarte", category:"Laticínios", price:7.89, icon:"🧈", tone:"#fff5d9", valid:"16–17 out", source:"Folheto oficial · Durval Nicolau"},
  {name:"Lava-roupas OMO", brand:"OMO", detail:"Embalagem promocional", category:"Limpeza", price:17.90, icon:"🧺", tone:"#e9edff", valid:"16–17 out", source:"Folheto oficial · Durval Nicolau"}
];

const categories = ["Todas", ...new Set(offers.map((offer) => offer.category))];
const grid = document.querySelector("#offer-grid");
const filters = document.querySelector("#filters");
const input = document.querySelector("#search-input");
const emptyState = document.querySelector("#empty-state");
const resultsSubtitle = document.querySelector("#results-subtitle");
let activeCategory = "Todas";

function money(value) {
  return new Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"}).format(value);
}

function renderFilters() {
  filters.innerHTML = categories.map((category) => `<button class="filter ${category === activeCategory ? "active" : ""}" type="button" data-category="${category}">${category}</button>`).join("");
}

function renderOffers() {
  const query = input.value.trim().toLocaleLowerCase("pt-BR");
  const matching = offers.filter((offer) => {
    const searchable = `${offer.name} ${offer.brand} ${offer.detail} ${offer.category}`.toLocaleLowerCase("pt-BR");
    return (activeCategory === "Todas" || offer.category === activeCategory) && (!query || searchable.includes(query));
  });
  grid.innerHTML = matching.map((offer) => `
    <article class="offer-card">
      <div class="visual" style="--tone:${offer.tone}"><span class="product-art" role="img" aria-label="Ilustração de ${offer.name}">${offer.icon}</span><span class="offer-sticker">OFERTA</span></div>
      <div class="card-body"><span class="category">${offer.category}</span><h3>${offer.name}</h3><span class="spec">${offer.detail}</span>
        <div class="price-row"><span class="price">${money(offer.price)}</span><span class="valid-until">Válido até<strong>${offer.valid} 2026</strong></span></div>
        <div class="card-source"><span class="source-dot"></span>${offer.source}</div>
      </div>
    </article>`).join("");
  emptyState.hidden = matching.length > 0;
  resultsSubtitle.textContent = `${matching.length} ${matching.length === 1 ? "oferta" : "ofertas"} · Sempre Vale`;
}

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

document.querySelector("#updated-label").textContent = "Encartes válidos hoje";
renderFilters();
renderOffers();
