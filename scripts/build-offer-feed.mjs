import { readFile, rename, writeFile } from "node:fs/promises";
import { assembleFeed } from "./feed/assemble-feed.mjs";
import { buildSnapshotManifest } from "./feed/snapshot-manifest.mjs";
import { createBuildInfo } from "./feed/build-info.mjs";
import { loadFallbackCatalog, loadPreviousSnapshots, loadSnapshots } from "./feed/load-sources.mjs";
import { validateFeed } from "./feed/validate-feed.mjs";
import { counterCutDetailHints } from "./domain/carnes-department.mjs";

const fallback = await loadFallbackCatalog();
const snapshots = await loadSnapshots();
const previousSnapshots = await loadPreviousSnapshots();
const { feed, warnings } = assembleFeed({
  fallbackStores: fallback.stores,
  fallbackOffers: fallback.offers,
  fallbackUpdatedAt: fallback.offersUpdatedAt,
  snapshots,
  previousSnapshots,
});

if (warnings.missingSnapshotStores.length > 0) {
  console.warn(`Skipped outdated fallback catalog for: ${warnings.missingSnapshotStores.join(", ")}.`);
}
if (warnings.droppedOffers.length > 0) {
  console.warn(`Dropped ${warnings.droppedOffers.length} offer(s) with no product name left after cleaning: ${warnings.droppedOffers.join(", ")}`);
}

validateFeed(feed);

const counterCutHints = feed.offers.flatMap((offer) => counterCutDetailHints(offer));
if (counterCutHints.length > 0) {
  console.warn(
    `Counter-cut offers missing kg detail (${counterCutHints.length} hidden from Açougue filter):\n- ${counterCutHints.slice(0, 20).join("\n- ")}`,
  );
}

const feedUrl = new URL("../offers.json", import.meta.url);
const temporaryFeedUrl = new URL("../offers.json.tmp", import.meta.url);
await writeFile(temporaryFeedUrl, `${JSON.stringify(feed, null, 2)}\n`);
await rename(temporaryFeedUrl, feedUrl);
const manifest = buildSnapshotManifest({
  snapshots,
  previousSnapshots,
  feedUpdatedAt: feed.updatedAt,
});
const manifestUrl = new URL("../snapshot-manifest.json", import.meta.url);
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated snapshot-manifest.json for ${manifest.current.length} current and ${manifest.previous.length} previous snapshot(s).`);
console.log(`Generated offers.json with ${feed.offers.length} offers from ${feed.stores.length} stores.`);

const packageInfo = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const buildInfo = createBuildInfo({ version: packageInfo.version });
await writeFile(new URL("../build-info.json", import.meta.url), `${JSON.stringify(buildInfo, null, 2)}\n`);
