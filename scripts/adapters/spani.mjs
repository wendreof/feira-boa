import storeConfig from "./data/spani-store.json" with { type: "json" };
import { classifyProduct } from "../domain/taxonomy.mjs";
import { normalizeOfferPresentation } from "../domain/presentation.mjs";
import { validateOffer } from "../domain/validation.mjs";
import { createOffer } from "./offer-factory.mjs";
import { fetchWithRetry } from "./http.mjs";
import { getWeekValidity } from "./paguemenos.mjs";

export { getWeekValidity };

const SPANI_OFFERS_URL = "https://www.spanionline.com.br/ofertas";
const STORE_NAME = "Spani Atacadista";
const STORE_BRANCH = "São João da Boa Vista · Jardim das Flores";
const STORE_SOURCE = "Ofertas online oficiais · retirada na loja";
const USER_AGENT = "FeiraBoaOfferIngest/1.0 (VIP Commerce public store API)";
const PAGE_SIZE = 20;
const MAX_PAGES = 50;

function apiUrl(path) {
  return `${storeConfig.apiBase}${path}`;
}

function vipHeaders(token, sessaoId, extra = {}) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
    domainkey: storeConfig.domain,
    organizationid: String(storeConfig.organizationId),
    FilialID: String(storeConfig.filialId),
    Authorization: `Bearer ${token}`,
    ...(sessaoId ? { "sessao-id": sessaoId } : {}),
    ...extra,
  };
}

function roundPrice(value) {
  return Number(Number(value).toFixed(2));
}

function parseApiPrice(value) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function offerNote(product) {
  const promo = product.oferta;
  if (!promo) return "Preço online oficial; pode variar na loja física";
  const parts = [promo.nome?.trim()].filter(Boolean);
  const minimum = Number(promo.quantidade_minima);
  if (Number.isFinite(minimum) && minimum > 1) parts.push(`mín. ${minimum} un.`);
  parts.push("Preço online oficial; pode variar na loja física");
  return parts.join(" · ");
}

function productDetail(product) {
  const unit = String(product.unidade_sigla ?? "").trim();
  return unit || "Unidade";
}

function titleCaseName(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(?:^|\s|\/)\S/g, (char) => char.toUpperCase());
}

export function buildSpaniOffer(product, { pageUrl = SPANI_OFFERS_URL, validity = getWeekValidity() } = {}) {
  if (!product?.disponivel || !product?.em_oferta) return null;

  const promo = product.oferta ?? {};
  const price = parseApiPrice(promo.menor_preco ?? promo.preco_oferta ?? product.preco);
  if (!Number.isFinite(price) || price <= 0) return null;

  const previousRaw = parseApiPrice(promo.preco_antigo);
  const previousPrice = Number.isFinite(previousRaw) && previousRaw > price ? roundPrice(previousRaw) : null;

  const name = titleCaseName(product.descricao);
  if (!name) return null;

  const detail = productDetail(product);
  const storeCategory = product.secao_id ? String(product.secao_id) : "";
  const taxonomy = classifyProduct(name, "Mercearia", storeCategory);

  const offer = createOffer({
    storeId: "spani",
    idKey: `${product.produto_id}-${validity.from}`,
    store: { name: STORE_NAME, logo: null, branch: STORE_BRANCH, source: STORE_SOURCE },
    sourceUrl: pageUrl,
    product: {
      name,
      detail,
      storeCategory,
      price: roundPrice(price),
      previousPrice,
      note: offerNote(product),
    },
    validity,
    taxonomy,
  });

  return validateOffer(offer) ? offer : null;
}

function dedupeOffers(offers) {
  const unique = new Map();
  for (const offer of offers) {
    const presented = normalizeOfferPresentation(offer);
    const key = `${presented.name}|${offer.detail}`;
    const existing = unique.get(key);
    if (!existing || offer.price < existing.price) unique.set(key, offer);
  }
  return [...unique.values()];
}

async function loginStore(fetchImpl = fetch) {
  const response = await fetchWithRetry(
    apiUrl(`/org/${storeConfig.organizationId}/auth/loja/login`),
    {
      method: "POST",
      headers: vipHeaders("", "", { Authorization: "Bearer" }),
      body: JSON.stringify({
        domain: storeConfig.domain,
        username: storeConfig.login.username,
        key: storeConfig.login.key,
      }),
    },
    { fetchImpl },
  );
  if (!response.ok) throw new Error(`Spani login failed (${response.status}).`);
  const payload = await response.json();
  const token = payload?.data;
  if (typeof token !== "string" || !token) throw new Error("Spani login returned no token.");
  return token;
}

async function openClientSession(token, fetchImpl = fetch) {
  const response = await fetchWithRetry(
    apiUrl(`/org/${storeConfig.organizationId}/loja/sessao_cliente`),
    { headers: vipHeaders(token) },
    { fetchImpl },
  );
  if (!response.ok) throw new Error(`Spani session failed (${response.status}).`);
  const payload = await response.json();
  return payload?.data?.sessao_id ?? "";
}

async function fetchOfferPage(page, token, sessaoId, fetchImpl = fetch, customPath = null) {
  const defaultPath = `/org/${storeConfig.organizationId}/filial/${storeConfig.filialId}/centro_distribuicao/${storeConfig.centroDistribuicaoId}/loja/produtos/em-oferta`;
  const basePath = customPath && customPath.startsWith("/") ? customPath : defaultPath;
  const separator = basePath.includes("?") ? "&" : "?";
  const path = `${basePath}${separator}page=${page}`;
  const response = await fetchWithRetry(apiUrl(path), { headers: vipHeaders(token, sessaoId) }, { fetchImpl });
  if (!response.ok) throw new Error(`Spani offers page ${page} failed (${response.status}).`);
  const payload = await response.json();
  if (!payload?.success || !Array.isArray(payload.data)) throw new Error("Spani offers returned an invalid response.");
  return payload;
}

export async function probeSpaniCatalog(fetchImpl = fetch) {
  const token = await loginStore(fetchImpl);
  const sessaoId = await openClientSession(token, fetchImpl);
  const payload = await fetchOfferPage(1, token, sessaoId, fetchImpl);
  const total = payload.paginator?.total_items;
  if (!Number.isFinite(total) || total <= 0) throw new Error("Spani catalog probe reported no products.");
  return { catalog_total: total };
}

export async function extractSpani(customUrl = null) {
  const pageUrl = customUrl?.trim() || SPANI_OFFERS_URL;
  const customPath = customUrl && customUrl.startsWith("/") ? customUrl : null;
  const validity = getWeekValidity();
  const token = await loginStore();
  const sessaoId = await openClientSession(token);

  const products = [];
  let totalPages = MAX_PAGES;
  for (let page = 1; page <= totalPages && page <= MAX_PAGES; page += 1) {
    const payload = await fetchOfferPage(page, token, sessaoId, fetch, customPath);
    products.push(...payload.data);
    totalPages = Math.min(Number(payload.paginator?.total_pages) || page, MAX_PAGES);
    if (page >= totalPages || payload.data.length < PAGE_SIZE) break;
  }

  const offers = dedupeOffers(products.map((product) => buildSpaniOffer(product, { pageUrl, validity })).filter(Boolean));
  if (offers.length === 0) {
    console.warn("Spani catalog returned 0 live offers for current cycle.");
  }

  return {
    storeId: "spani",
    store: {
      name: STORE_NAME,
      branch: STORE_BRANCH,
      logo: null,
      source: STORE_SOURCE,
      sourceUrl: pageUrl,
      from: validity.from,
      to: validity.to,
    },
    fetchedAt: new Date().toISOString(),
    sourceUrl: pageUrl,
    offers,
    status: offers.length > 0 ? "ok" : "no_active_offers",
  };
}
