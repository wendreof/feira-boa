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

export function getVerifiedActiveOffers(offers, sourceState, today = saoPauloDate()) {
  return offers.filter((offer) => {
    const source = sourceState[offer.sourceUrl];
    return source && source.needs_review !== true && offer.validFrom <= today && offer.validTo >= today;
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
