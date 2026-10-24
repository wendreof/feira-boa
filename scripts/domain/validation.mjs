export function validateOffer(offer) {
  if (!offer || typeof offer !== "object") return false;
  if (!offer.id || typeof offer.id !== "string") return false;
  if (!offer.store || !offer.branch || !offer.name) return false;
  if (!/^https:\/\//.test(offer.sourceUrl)) return false;
  if (!Number.isFinite(offer.price) || offer.price <= 0) return false;
  if (offer.previousPrice !== null && (!Number.isFinite(offer.previousPrice) || offer.previousPrice <= offer.price)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(offer.validFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(offer.validTo)) return false;
  if (offer.validFrom > offer.validTo) return false;
  if (!offer.productType || !Array.isArray(offer.productTypes) || !offer.productTypes.includes(offer.productType)) return false;
  return true;
}

export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (!snapshot.storeId || !snapshot.store || !Array.isArray(snapshot.offers)) return false;
  if (snapshot.offers.length === 0) return false;
  return snapshot.offers.every(validateOffer);
}
