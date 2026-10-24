import { foldText } from "../../src/shared/text.mjs";
import { classifyProduct } from "../domain/taxonomy.mjs";
import { mergeBrandIntoName } from "../domain/brands.mjs";
import { fetchWithRetry } from "./http.mjs";
import { normalizeOfferPresentation } from "../domain/presentation.mjs";
import { validateOffer } from "../domain/validation.mjs";
import { createOffer } from "./offer-factory.mjs";

const PAGUE_MENOS_URL = "https://www.superpaguemenos.com.br/ofertas?productclusterids=161&fuzzy=0&operator=and&facets=productclusterids%2Cfuzzy%2Coperator&sort=score_desc&page=0";
const PAGUE_MENOS_API_URL = "https://www.superpaguemenos.com.br/api/catalog_system/pub/products/search";
const PAGUE_MENOS_COLLECTION_ID = "161";
const PAGE_SIZE = 50;
const MAX_PAGES = 40;
const STORE_LOGO = "https://yata-apix-ffbe8645-e2d3-4333-a3d7-a50dd75a9365.s3-object.locaweb.com.br/26b38c95de59446292057c272a15e0c2.png";
const STORE_BRANCH = "Loja 33 · Jardim Santo André";
const STORE_SOURCE = "Ofertas online oficiais · Loja 33";
const USER_AGENT = "FeiraBoaOfferIngest/1.1 (official public catalog API)";

const UNIT_PATTERN = /(?:\s|^)((?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:kg|mg|g|ml|l|cm|mm|m|unidades?|unids?\.?|unid\.?|un|caps?|cápsulas?|comprimidos?|folhas?|rolos?|sachês?|saches?|pacotes?|pct|peças?|fatias?|lâminas?|tabletes?))\.?\s*$/i;
const UNIT_ONLY_PATTERN = /^(.*?)\s+unidade\.?$/i;

const CATEGORY_MAP = new Map([
  ["acougue", "Carnes"],
  ["bazar", "Casa"],
  ["cafe da manha", "Mercearia"],
  ["frios e laticinios", "Frios"],
  ["hortifruti", "Hortifruti"],
  ["mamae e bebe", "Higiene"],
  ["padaria", "Padaria"],
  ["perfumaria", "Higiene"],
  ["vestuario", "Vestuário"],
]);

function normalizeCategory(value) {
  return foldText(value).trim();
}

export function getWeekValidity(now = new Date()) {
  const spDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const today = new Date(`${spDate}T12:00:00Z`);
  const dayOfWeek = today.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

function cleanProductName(value) {
  return value.replace(/\s+com$/i, "").trim();
}

function splitProductName(fullName) {
  const match = fullName.match(UNIT_PATTERN);
  if (match) {
    const nameOnly = cleanProductName(fullName.slice(0, match.index));
    if (nameOnly) return { nameOnly, detail: match[1].trim() };
  }
  const unitOnly = fullName.match(UNIT_ONLY_PATTERN);
  if (unitOnly?.[1].trim()) return { nameOnly: cleanProductName(unitOnly[1]), detail: "Unidade" };
  return { nameOnly: cleanProductName(fullName) || fullName, detail: "Unidade" };
}

function categoryFromPath(path) {
  const topLevel = String(path ?? "").split("/").filter(Boolean)[0] ?? "";
  if (!topLevel) return "Mercearia";
  return CATEGORY_MAP.get(normalizeCategory(topLevel)) ?? topLevel;
}

/** Caminho completo de categoria do catálogo, usado como sinal principal. */
function storeCategoryPath(path) {
  return String(path ?? "").split("/").filter(Boolean).slice(0, 3).join("/");
}

function getSellerOffer(item) {
  const seller = item?.sellers?.find((entry) => entry.sellerDefault) ?? item?.sellers?.[0];
  return seller?.commertialOffer ?? null;
}

function roundPrice(value) {
  return Number(value.toFixed(2));
}

export function buildPagueMenosOffer(product, { pageUrl = PAGUE_MENOS_URL, validity = getWeekValidity() } = {}) {
  const item = product?.items?.[0];
  const commercialOffer = getSellerOffer(item);
  const price = Number(commercialOffer?.Price);
  if (!commercialOffer?.IsAvailable || !Number.isFinite(price) || price <= 0) return null;

  const fullName = String(product?.productName ?? "").replace(/\s+/g, " ").trim();
  if (!fullName) return null;

  const listPrice = Number(commercialOffer.ListPrice);
  const previousPrice = Number.isFinite(listPrice) && listPrice > price ? roundPrice(listPrice) : null;
  const brand = String(product?.brand ?? "").replace(/\s+/g, " ").trim();
  const category = categoryFromPath(product?.categories?.[0]);
  const { nameOnly, detail } = splitProductName(fullName);
  const storeCategory = storeCategoryPath(product?.categories?.[0]);
  const name = mergeBrandIntoName(nameOnly, brand);
  const taxonomy = classifyProduct(name, category, storeCategory);

  const offer = createOffer({
    storeId: "paguemenos",
    idKey: `${nameOnly}-${brand}-${detail}-${validity.from}`,
    store: { name: "Pague Menos", logo: STORE_LOGO, branch: STORE_BRANCH, source: STORE_SOURCE },
    sourceUrl: pageUrl,
    product: {
      name,
      detail,
      storeCategory,
      price: roundPrice(price),
      previousPrice,
      note: "Preço online oficial; pode variar na loja física",
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

function collectionIdFromUrl(pageUrl) {
  try {
    return new URL(pageUrl).searchParams.get("productclusterids")?.trim() || PAGUE_MENOS_COLLECTION_ID;
  } catch {
    return PAGUE_MENOS_COLLECTION_ID;
  }
}

function totalProducts(response) {
  const resources = response.headers.get("resources");
  const match = resources?.match(/\/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

/**
 * Structural probe for the source monitor. The storefront page for this source
 * is a client-rendered shell whose bytes change on every store redeploy, so the
 * monitor watches the catalog API instead: it only needs to know the API still
 * answers with a non-empty product page and how many products it lists.
 */
export async function probePagueMenosCatalog(fetchImpl = fetch) {
  const apiUrl = new URL(PAGUE_MENOS_API_URL);
  apiUrl.searchParams.set("fq", `productClusterIds:${PAGUE_MENOS_COLLECTION_ID}`);
  apiUrl.searchParams.set("_from", "0");
  apiUrl.searchParams.set("_to", String(PAGE_SIZE - 1));

  const response = await fetchWithRetry(apiUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  }, { fetchImpl });
  if (!response.ok) throw new Error(`Pague Menos catalog probe failed (${response.status}).`);
  const batch = await response.json();
  if (!Array.isArray(batch) || batch.length === 0) throw new Error("Pague Menos catalog probe returned no products.");
  const total = totalProducts(response) ?? batch.length;
  if (!Number.isFinite(total) || total <= 0) throw new Error("Pague Menos catalog probe reported no products.");
  return { catalog_total: total };
}

async function fetchCollection(pageUrl) {
  const collectionId = collectionIdFromUrl(pageUrl);
  const products = [];
  let total = null;

  for (let page = 0, from = 0; page < MAX_PAGES; page += 1, from += PAGE_SIZE) {
    const apiUrl = new URL(PAGUE_MENOS_API_URL);
    apiUrl.searchParams.set("fq", `productClusterIds:${collectionId}`);
    apiUrl.searchParams.set("_from", String(from));
    apiUrl.searchParams.set("_to", String(from + PAGE_SIZE - 1));

    const response = await fetchWithRetry(apiUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Could not fetch Pague Menos catalog page ${page + 1} (${response.status})`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error("Pague Menos catalog returned an invalid response.");

    total ??= totalProducts(response);
    products.push(...batch);
    if (batch.length < PAGE_SIZE || (total !== null && products.length >= total)) break;
  }

  if (total !== null && products.length !== total) {
    throw new Error(`Pague Menos catalog returned ${products.length} of ${total} products.`);
  }
  return products;
}

export async function extractPagueMenos(customUrl = null) {
  const pageUrl = customUrl?.trim() || PAGUE_MENOS_URL;
  const validity = getWeekValidity();
  const products = await fetchCollection(pageUrl);
  const offers = dedupeOffers(products.map((product) => buildPagueMenosOffer(product, { pageUrl, validity })).filter(Boolean));

  if (offers.length === 0) throw new Error("Pague Menos catalog returned no available offers.");

  return {
    storeId: "paguemenos",
    store: {
      name: "Pague Menos",
      branch: STORE_BRANCH,
      logo: STORE_LOGO,
      source: STORE_SOURCE,
      sourceUrl: pageUrl,
      from: validity.from,
      to: validity.to,
    },
    fetchedAt: new Date().toISOString(),
    sourceUrl: pageUrl,
    offers,
    status: "ok",
  };
}
