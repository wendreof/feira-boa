import { assignIcon } from "../domain/icons.mjs";
import { classifyProduct } from "../domain/taxonomy.mjs";
import { normalizeOfferPresentation } from "../domain/presentation.mjs";
import { ARCHIVE_OFFER_CAP, archivedOfferId } from "../domain/snapshot-campaign.mjs";
import { applyPublishedLogos } from "../domain/store-logos.mjs";

/**
 * Indexa snapshots que trazem metadados da loja (com ou sem ofertas transcritas).
 * @returns {Map<string, any>} snapshots indexados por storeId (ou nome da loja)
 */
export function indexSnapshots(snapshots) {
  const byStore = new Map();
  for (const snapshot of snapshots) {
    if (snapshot?.store) {
      byStore.set(snapshot.storeId || snapshot.store.name, snapshot);
    }
  }
  return byStore;
}

function publishStore(snapshot) {
  const published = { ...snapshot.store };
  if (Array.isArray(snapshot.flyerImages) && snapshot.flyerImages.length > 0) {
    published.flyerImages = snapshot.flyerImages;
  }
  return published;
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
  const published = normalizeOfferPresentation(offer);
  if (!published.name) return null;

  // Re-derive the taxonomy from the store's own category so a classification
  // fix lands on every offer without waiting for the next ingestion.
  const taxonomy = classifyProduct(published.name, published.category ?? "Outros", published.storeCategory ?? "");
  published.category = taxonomy.department;
  published.department = taxonomy.department;
  published.productType = taxonomy.productType;
  published.productTypes = taxonomy.productTypes;
  published.icon = assignIcon(published.name, taxonomy.productType, taxonomy.department);
  return published;
}

function publishArchivedCampaigns(previousSnapshots) {
  const archivedCampaigns = [];
  for (const snapshot of previousSnapshots) {
    if (!snapshot?.store || !Array.isArray(snapshot.offers) || snapshot.offers.length === 0) continue;
    const storeId = snapshot.storeId || snapshot.store.name;
    const publishedOffers = [];
    for (const offer of snapshot.offers.slice(0, ARCHIVE_OFFER_CAP)) {
      const published = publishOffer({ ...offer, id: archivedOfferId(storeId, offer.id) });
      if (published) publishedOffers.push(published);
    }
    if (publishedOffers.length === 0) continue;
    const { offers: logoOffers } = applyPublishedLogos({
      stores: [publishStore(snapshot)],
      offers: publishedOffers,
      snapshotsByStore: new Map([[storeId, snapshot]]),
    });
    archivedCampaigns.push({
      storeId,
      store: publishStore(snapshot),
      supersededAt: snapshot.supersededAt || snapshot.fetchedAt || null,
      offers: logoOffers,
    });
  }
  return archivedCampaigns;
}

/**
 * Monta o feed publicado. Snapshots das lojas têm prioridade; o catálogo
 * curado (`fallback`) só entra quando nenhum snapshot existe, para não misturar
 * preços antigos com dados novos.
 *
 * Função pura: não lê nem escreve arquivos.
 */
/**
 * @param {{ fallbackStores: any[], fallbackOffers: any[], fallbackUpdatedAt: string, snapshots: any[], previousSnapshots?: any[] }} input
 */
export function assembleFeed({ fallbackStores, fallbackOffers, fallbackUpdatedAt, snapshots, previousSnapshots = [] }) {
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
      storeMap.set(snapshot.store.name, publishStore(snapshot));
      rawOffers.push(...(snapshot.offers ?? []));
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

  const { stores: publishedStores, offers: publishedOffers } = applyPublishedLogos({
    stores: [...storeMap.values()],
    offers,
    snapshotsByStore,
  });

  const archivedCampaigns = publishArchivedCampaigns(previousSnapshots);

  return {
    feed: {
      schemaVersion: 1,
      updatedAt,
      stores: publishedStores,
      offers: publishedOffers,
      archivedCampaigns,
    },
    warnings: { missingSnapshotStores, droppedOffers },
  };
}
