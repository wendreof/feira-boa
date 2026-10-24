import { execFileSync } from "node:child_process";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { assignIcon, classifyProduct, normalizeOfferPresentation } from "./adapters/common.mjs";
import { presentationViolations } from "./offer-name-guard.mjs";
import { sectorViolations } from "./offer-sector-guard.mjs";
import { resolveCategory } from "../catalog-taxonomy.mjs";

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL("../offers.ts", import.meta.url))],
  bundle: true,
  format: "iife",
  globalName: "OfferCatalog",
  platform: "browser",
  target: "es2020",
  write: false,
});
const sandbox = {};
vm.runInNewContext(outputFiles[0].text, sandbox, { filename: "offers.ts" });

const fallbackCatalog = sandbox.OfferCatalog;
if (!Array.isArray(fallbackCatalog.offers) || !Array.isArray(fallbackCatalog.stores) || !Number.isFinite(Date.parse(fallbackCatalog.offersUpdatedAt))) {
  throw new Error("Offer source did not produce offers and stores.");
}

// Check state directory for automated store snapshots
const stateDir = new URL("../state/", import.meta.url);
const snapshotsByStore = new Map();
let latestSnapshotDate = fallbackCatalog.offersUpdatedAt;

try {
  const files = await readdir(stateDir);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = await readFile(new URL(`../state/${file}`, import.meta.url), "utf8");
      const snapshot = JSON.parse(content);
      if (snapshot.store && Array.isArray(snapshot.offers) && snapshot.offers.length > 0) {
        snapshotsByStore.set(snapshot.storeId || snapshot.store.name, snapshot);
        if (snapshot.fetchedAt && (!latestSnapshotDate || snapshot.fetchedAt > latestSnapshotDate)) {
          latestSnapshotDate = snapshot.fetchedAt;
        }
      }
    } catch {
      // Ignore invalid single snapshot file and fall back to curated source
    }
  }
} catch {
  // State directory doesn't exist yet
}

// Assemble stores and offers: prefer snapshots. The curated `offers.ts` catalog
// is a development fallback only; publishing it next to fresh snapshots would
// mix outdated prices and expired validity dates into the live feed.
const storeMap = new Map();
const allOffers = [];
const hasSnapshots = snapshotsByStore.size > 0;

// Index fallback stores
for (const store of fallbackCatalog.stores) {
  storeMap.set(store.name, store);
}

// Index fallback offers by store name
const fallbackByStore = Map.groupBy(fallbackCatalog.offers, (o) => o.store);

// For each known store, use snapshot if available with offers, otherwise fallback
const allStoreNames = new Set([...storeMap.keys(), ...[...snapshotsByStore.values()].map((s) => s.store.name)]);
const snapshotOfferIds = new Set();
const missingSnapshotStores = [];

for (const storeName of allStoreNames) {
  const snapshot = [...snapshotsByStore.values()].find((s) => s.store.name === storeName || s.storeId === storeName);
  if (snapshot) {
    // A snapshot vale mesmo com zero ofertas: a loja continua visível e a
    // falta de ofertas fica aparente como condição de saúde da fonte.
    storeMap.set(snapshot.store.name, snapshot.store);
    for (const offer of snapshot.offers) {
      snapshotOfferIds.add(offer.id);
      allOffers.push(offer);
    }
  } else if (fallbackByStore.has(storeName)) {
    if (hasSnapshots) {
      missingSnapshotStores.push(storeName);
    } else {
      allOffers.push(...fallbackByStore.get(storeName));
    }
  }
}

if (missingSnapshotStores.length > 0) {
  console.warn(`Skipped outdated fallback catalog for: ${missingSnapshotStores.join(", ")}.`);
}

const stores = [...storeMap.values()];
const offers = [];
const offersUpdatedAt = latestSnapshotDate;
const droppedOffers = [];

for (const offer of allOffers) {
  Object.assign(offer, normalizeOfferPresentation(offer));
  if (!offer.name) {
    // Fragmento de preço sem produto (ex.: "NESTA EMBALAGEM A UNIDADE SAI POR:"):
    // a limpeza de apresentação esvaziou o nome, então a oferta não existe.
    droppedOffers.push(offer.id);
    continue;
  }
  if (snapshotOfferIds.has(offer.id)) {
    // Snapshots keep the icon captured at ingest time; refresh it so rule changes apply without re-ingesting.
    offer.icon = assignIcon(offer.name, offer.productType, offer.department);
  }
  // Re-derive the taxonomy from the store's own category so a classification
  // fix lands on every offer without waiting for the next ingestion.
  const taxonomy = classifyProduct(offer.name, offer.brand ?? "", offer.category ?? "Outros", offer.storeCategory ?? "");
  offer.category = taxonomy.department;
  offer.department = taxonomy.department;
  offer.productType = taxonomy.productType;
  offer.productTypes = taxonomy.productTypes;
  offer.icon = assignIcon(offer.name, taxonomy.productType, taxonomy.department);
  offers.push(offer);
}
if (droppedOffers.length > 0) {
  console.warn(`Dropped ${droppedOffers.length} offer(s) with no product name left after cleaning: ${droppedOffers.join(", ")}`);
}

const ids = new Set();
const storeUrls = new Set(stores.map((store) => store.sourceUrl));
for (const store of stores) {
  if (!store.name || !store.branch || !/^https:\/\//.test(store.sourceUrl) || !/^\d{4}-\d{2}-\d{2}$/.test(store.from) || !/^\d{4}-\d{2}-\d{2}$/.test(store.to) || store.from > store.to) {
    throw new Error(`Invalid store source record: ${store.name || "unnamed store"}`);
  }
}
if (storeUrls.size !== stores.length) throw new Error("Duplicate store source URL in offer catalog.");
const sectorProblems = [];
const presentationProblems = [];
for (const offer of offers) {
  if (!offer.id || ids.has(offer.id)) throw new Error(`Missing or duplicate offer ID: ${offer.id}`);
  if (!offer.name || !offer.store || !offer.detail || !offer.productType || !Array.isArray(offer.productTypes) || !offer.productTypes.includes(offer.productType)) {
    throw new Error(`Offer is missing required product fields: ${offer.id}`);
  }
  if (!storeUrls.has(offer.sourceUrl) || !/^https:\/\//.test(offer.sourceUrl)) throw new Error(`Offer has no known official source: ${offer.id}`);
  if (!Number.isFinite(offer.price) || offer.price <= 0 || (offer.previousPrice !== null && (!Number.isFinite(offer.previousPrice) || offer.previousPrice <= offer.price))) {
    throw new Error(`Offer has an invalid price: ${offer.id}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(offer.validFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(offer.validTo) || offer.validFrom > offer.validTo) {
    throw new Error(`Offer has invalid validity dates: ${offer.id}`);
  }
  const sector = resolveCategory(offer);
  const text = `${offer.name} ${offer.brand ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  sectorProblems.push(...sectorViolations(offer.name, offer.brand ?? "", sector.groupId, text));
  presentationProblems.push(...presentationViolations(offer));
  ids.add(offer.id);
}
if (sectorProblems.length > 0) {
  throw new Error(`Offers are in the wrong sector:\n- ${sectorProblems.slice(0, 20).join("\n- ")}`);
}
if (presentationProblems.length > 0) {
  throw new Error(`Offers carry flyer text in the published fields — extend scripts/adapters/common.mjs cleaning:\n- ${presentationProblems.slice(0, 20).join("\n- ")}`);
}

const feed = { schemaVersion: 1, updatedAt: offersUpdatedAt, stores, offers };
const feedUrl = new URL("../offers.json", import.meta.url);
const temporaryFeedUrl = new URL("../offers.json.tmp", import.meta.url);
await writeFile(temporaryFeedUrl, `${JSON.stringify(feed, null, 2)}\n`);
await rename(temporaryFeedUrl, feedUrl);
console.log(`Generated offers.json with ${offers.length} offers from ${stores.length} stores.`);

const packageInfo = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
let commit = process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local";
let dirty = false;
if (commit === "local") {
  try {
    commit = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" }).trim();
    dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
  } catch {
    commit = "local";
  }
}
const buildInfo = {
  version: packageInfo.version,
  commit: commit.slice(0, 7),
  builtAt: new Date().toISOString(),
  dirty,
};
await writeFile(new URL("../build-info.json", import.meta.url), `${JSON.stringify(buildInfo, null, 2)}\n`);
