import { execFileSync } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

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

const { offers, stores, offersUpdatedAt } = sandbox.OfferCatalog;
if (!Array.isArray(offers) || !Array.isArray(stores) || !Number.isFinite(Date.parse(offersUpdatedAt))) {
  throw new Error("Offer source did not produce offers and stores.");
}

const ids = new Set();
const storeUrls = new Set(stores.map((store) => store.sourceUrl));
for (const store of stores) {
  if (!store.name || !store.branch || !/^https:\/\//.test(store.sourceUrl) || !/^\d{4}-\d{2}-\d{2}$/.test(store.from) || !/^\d{4}-\d{2}-\d{2}$/.test(store.to) || store.from > store.to) {
    throw new Error(`Invalid store source record: ${store.name || "unnamed store"}`);
  }
}
if (storeUrls.size !== stores.length) throw new Error("Duplicate store source URL in offer catalog.");
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
  ids.add(offer.id);
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
