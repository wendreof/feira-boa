import { writeFile } from "node:fs/promises";
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
for (const offer of offers) {
  if (!offer.id || ids.has(offer.id)) throw new Error(`Missing or duplicate offer ID: ${offer.id}`);
  ids.add(offer.id);
}

const feed = { schemaVersion: 1, updatedAt: offersUpdatedAt, stores, offers };
await writeFile(new URL("../offers.json", import.meta.url), `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Generated offers.json with ${offers.length} offers from ${stores.length} stores.`);
