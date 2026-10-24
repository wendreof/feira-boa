import { slugText } from "../shared/text.mjs";
export const MAX_SOURCE_AGE_MS = 24 * 60 * 60 * 1000;

export function saoPauloDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function storeKey(store, branch = "") {
  return slugText(`${store ?? ""} ${branch ?? ""}`);
}

function lastSuccessAt(source) {
  return Date.parse(source?.last_success_at ?? source?.lastSuccessAt ?? "");
}

function buildStoreIndex(sourceState) {
  const byStore = new Map();
  for (const source of Object.values(sourceState ?? {})) {
    if (!source || typeof source !== "object") continue;
    const exact = source.store_key || storeKey(source.store, source.branch);
    if (exact) byStore.set(exact, source);
    if (source.store) byStore.set(storeKey(source.store), source);
  }
  return byStore;
}

export function getVerifiedActiveOffers(offers, sourceState, today = saoPauloDate(), now = Date.now()) {
  const byStore = buildStoreIndex(sourceState);
  return offers.filter((offer) => {
    const source = sourceState?.[offer.sourceUrl] ?? byStore.get(storeKey(offer.store, offer.branch)) ?? byStore.get(storeKey(offer.store));
    if (!source || source.needs_review === true) return false;
    const success = lastSuccessAt(source);
    if (!Number.isFinite(success) || now - success > MAX_SOURCE_AGE_MS) return false;
    return offer.validFrom <= today && offer.validTo >= today;
  });
}

export function ruleMatchesOffer(rule, offer) {
  if (rule.store && rule.store !== offer.store) return false;
  if (rule.product_type && !offer.productTypes.includes(rule.product_type)) return false;
  if (rule.product && rule.product !== offer.name && rule.product !== offer.id) return false;
  return offer.price <= Number(rule.target_price);
}

export function formatOfferPrice(price) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
}
