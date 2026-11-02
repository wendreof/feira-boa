/**
 * @param {any[]} snapshots
 * @param {any[]} previousSnapshots
 * @param {string} feedUpdatedAt
 */
export function buildSnapshotManifest({ snapshots, previousSnapshots, feedUpdatedAt }) {
  const mapEntry = (snapshot, role) => {
    const store = snapshot?.store ?? {};
    return {
      role,
      storeId: snapshot?.storeId ?? store.name ?? "unknown",
      storeName: store.name ?? "",
      branch: store.branch ?? "",
      fetchedAt: snapshot?.fetchedAt ?? null,
      supersededAt: snapshot?.supersededAt ?? null,
      offerCount: Array.isArray(snapshot?.offers) ? snapshot.offers.length : 0,
      status: snapshot?.status ?? (snapshot?.offers?.length ? "ok" : "empty"),
      validFrom: store.from ?? "",
      validTo: store.to ?? "",
      sourceUrl: store.sourceUrl ?? snapshot?.sourceUrl ?? "",
    };
  };

  return {
    schemaVersion: 1,
    updatedAt: feedUpdatedAt,
    current: snapshots.filter((entry) => entry?.store).map((entry) => mapEntry(entry, "current")),
    previous: previousSnapshots.filter((entry) => entry?.store).map((entry) => mapEntry(entry, "previous")),
  };
}
