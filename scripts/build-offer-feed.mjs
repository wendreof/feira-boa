import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
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
