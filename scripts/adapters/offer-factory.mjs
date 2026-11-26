import { slugText } from "../../src/shared/text.mjs";
import { logoUrlForStoreName } from "../../src/shared/store-logos.mjs";
import { assignIcon } from "../domain/icons.mjs";

export const DEFAULT_OFFER_TONE = "#edf4e9";

/**
 * Monta o registro de oferta publicado por um adapter de loja. Centraliza o
 * formato comum (id, taxonomia, ícone, validade e fonte) para que cada adapter
 * só declare o que é específico da loja.
 *
 * @param {object} fields
 * @param {string} fields.storeId prefixo do id (ex.: "corso")
 * @param {string} fields.idKey texto que identifica a oferta dentro da loja
 * @param {object} fields.store { name, logo, branch, source }
 * @param {string} fields.sourceUrl URL pública da oferta na fonte oficial
 * @param {object} fields.product { name, detail, storeCategory?, price, previousPrice?, note? }
 * @param {{ from: string, to: string, validWeekdays?: number[] | null }} fields.validity
 * @param {{ department: string, productType: string, productTypes: string[] }} fields.taxonomy
 * @param {string[]} [fields.promoTags] optional campaign tags (e.g. black-friday)
 */
export function createOffer({ storeId, idKey, store, sourceUrl, product, validity, taxonomy, promoTags }) {
  const offer = {
    id: `${storeId}-${slugText(idKey)}`,
    store: store.name,
    storeLogo: logoUrlForStoreName(store.name) ?? store.logo,
    branch: store.branch,
    name: product.name,
    detail: product.detail,
    category: taxonomy.department,
    department: taxonomy.department,
    productType: taxonomy.productType,
    productTypes: taxonomy.productTypes,
  };
  if (product.storeCategory !== undefined) offer.storeCategory = product.storeCategory;
  Object.assign(offer, {
    price: product.price,
    previousPrice: product.previousPrice ?? null,
    icon: assignIcon(product.name, taxonomy.productType, taxonomy.department),
    tone: DEFAULT_OFFER_TONE,
    note: product.note ?? "",
    validFrom: validity.from,
    validTo: validity.to,
    source: store.source,
    sourceUrl,
  });
  if (Array.isArray(validity.validWeekdays) && validity.validWeekdays.length > 0) {
    offer.validWeekdays = validity.validWeekdays;
  }
  if (Array.isArray(promoTags) && promoTags.length > 0) {
    offer.promoTags = promoTags;
  }
  return offer;
}
