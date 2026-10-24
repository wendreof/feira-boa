import { assignIcon } from "../domain/icons.mjs";
import { classifyProduct } from "../domain/taxonomy.mjs";
import { normalizeOfferPresentation } from "../domain/presentation.mjs";

/**
 * Snapshots válidos são os que trazem loja e ao menos uma oferta.
 * @returns {Map<string, any>} snapshots indexados por storeId (ou nome da loja)
 */
export function indexSnapshots(snapshots) {
  const byStore = new Map();
  for (const snapshot of snapshots) {
    if (snapshot?.store && Array.isArray(snapshot.offers) && snapshot.offers.length > 0) {
      byStore.set(snapshot.storeId || snapshot.store.name, snapshot);
    }
  }
  return byStore;
}

function latestFetchedAt(snapshots, fallbackUpdatedAt) {
  let latest = fallbackUpdatedAt;
  for (const snapshot of snapshots) {
    if (snapshot.fetchedAt && (!latest || snapshot.fetchedAt > latest)) latest = snapshot.fetchedAt;
  }
  return latest;
}

function findSnapshot(snapshotsByStore, storeName) {
  return [...snapshotsByStore.values()].find((s) => s.store.name === storeName || s.storeId === storeName);
}

/**
 * Aplica a apresentação e a taxonomia atuais a uma oferta. Retorna null quando
 * a limpeza esvazia o nome (fragmento de preço sem produto).
 */
function publishOffer(offer) {
  Object.assign(offer, normalizeOfferPresentation(offer));
  if (!offer.name) return null;

  // Re-derive the taxonomy from the store's own category so a classification
  // fix lands on every offer without waiting for the next ingestion.
  const taxonomy = classifyProduct(offer.name, offer.brand ?? "", offer.category ?? "Outros", offer.storeCategory ?? "");
  offer.category = taxonomy.department;
  offer.department = taxonomy.department;
  offer.productType = taxonomy.productType;
  offer.productTypes = taxonomy.productTypes;
  offer.icon = assignIcon(offer.name, taxonomy.productType, taxonomy.department);
  return offer;
}

/**
 * Monta o feed publicado. Snapshots das lojas têm prioridade; o catálogo
 * curado (`fallback`) só entra quando nenhum snapshot existe, para não misturar
 * preços antigos com dados novos.
 *
 * Função pura: não lê nem escreve arquivos.
 */
/**
 * @param {{ fallbackStores: any[], fallbackOffers: any[], fallbackUpdatedAt: string, snapshots: any[] }} input
 */
export function assembleFeed({ fallbackStores, fallbackOffers, fallbackUpdatedAt, snapshots }) {
  const snapshotsByStore = indexSnapshots(snapshots);
  const hasSnapshots = snapshotsByStore.size > 0;
  const updatedAt = latestFetchedAt([...snapshotsByStore.values()], fallbackUpdatedAt);

  const storeMap = new Map(fallbackStores.map((store) => [store.name, store]));
  const fallbackByStore = Map.groupBy(fallbackOffers, (offer) => offer.store);
  const storeNames = new Set([...storeMap.keys(), ...[...snapshotsByStore.values()].map((s) => s.store.name)]);

  const rawOffers = [];
  const missingSnapshotStores = [];
  for (const storeName of storeNames) {
    const snapshot = findSnapshot(snapshotsByStore, storeName);
    if (snapshot) {
      // A loja continua visível mesmo que o snapshot traga poucas ofertas.
      storeMap.set(snapshot.store.name, snapshot.store);
      rawOffers.push(...snapshot.offers);
    } else if (fallbackByStore.has(storeName)) {
      if (hasSnapshots) missingSnapshotStores.push(storeName);
      else rawOffers.push(...fallbackByStore.get(storeName));
    }
  }

  const offers = [];
  const droppedOffers = [];
  for (const offer of rawOffers) {
    const published = publishOffer(offer);
    if (published) offers.push(published);
    else droppedOffers.push(offer.id);
  }

  return {
    feed: { schemaVersion: 1, updatedAt, stores: [...storeMap.values()], offers },
    warnings: { missingSnapshotStores, droppedOffers },
  };
}
