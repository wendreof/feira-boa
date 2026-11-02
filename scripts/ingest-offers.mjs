import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { extractBigBom } from "./adapters/bigbom.mjs";
import { extractSempreVale } from "./adapters/semprevale.mjs";
import { extractPagueMenos } from "./adapters/paguemenos.mjs";
import { extractSpasso } from "./adapters/spasso.mjs";
import { extractCorso } from "./adapters/corso.mjs";
import { validateSnapshot } from "./domain/validation.mjs";

const STATE_DIR = new URL("../state/", import.meta.url);
await mkdir(STATE_DIR, { recursive: true });

const ADAPTERS = [
  { id: "sempre", name: "Sempre Vale", runner: extractSempreVale },
  { id: "bigbom", name: "Big Bom", runner: extractBigBom },
  { id: "corso", name: "Corso", runner: extractCorso },
  { id: "paguemenos", name: "Pague Menos", runner: extractPagueMenos },
  { id: "spasso", name: "Spasso Sabores", runner: extractSpasso },
];

async function loadExistingSnapshot(storeId) {
  try {
    const fileUrl = new URL(`../state/${storeId}.json`, import.meta.url);
    const content = await readFile(fileUrl, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function saveSnapshot(storeId, snapshot) {
  const fileUrl = new URL(`../state/${storeId}.json`, import.meta.url);
  await writeFile(fileUrl, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

async function ingestAll() {
  console.log("Starting automatic offer ingestion for all stores...");
  const results = [];

  for (const { id, name, runner } of ADAPTERS) {
    const existing = await loadExistingSnapshot(id);
    try {
      console.log(`[${name}] Extracting live offers...`);
      const snapshot = await runner();

      if (snapshot.offers.length > 0 && validateSnapshot(snapshot)) {
        await saveSnapshot(id, snapshot);
        console.log(`[${name}] OK: Extracted ${snapshot.offers.length} offers (valid ${snapshot.store.from} to ${snapshot.store.to}).`);
        results.push({ id, name, status: "updated", count: snapshot.offers.length });
      } else if (snapshot.offers.length > 0) {
        console.warn(`[${name}] Snapshot produced offers but failed validation; retaining previous snapshot.`);
        results.push({ id, name, status: "retained_validation_failure", count: existing?.offers?.length ?? 0 });
      } else if (existing && existing.offers?.length > 0) {
        console.log(`[${name}] No new text offers extracted; retaining existing snapshot with ${existing.offers.length} items.`);
        results.push({ id, name, status: "retained", count: existing.offers.length });
      } else {
        await saveSnapshot(id, snapshot);
        console.log(`[${name}] Snapshot saved with status: ${snapshot.status}.`);
        results.push({ id, name, status: snapshot.status, count: 0 });
      }
    } catch (error) {
      console.warn(`[${name}] Extraction error: ${error.message}; retaining existing snapshot.`);
      results.push({ id, name, status: "error", error: error.message, count: existing?.offers?.length ?? 0 });
    }
  }

  console.log("\nRebuilding offer feed from validated snapshots...");
  const buildScript = fileURLToPath(new URL("./build-offer-feed.mjs", import.meta.url));
  execFileSync(process.execPath, [buildScript], { stdio: "inherit" });

  console.log("\nIngestion complete summary:");
  for (const r of results) {
    console.log(`- ${r.name}: ${r.status} (${r.count} offers)`);
  }
}

ingestAll().catch((err) => {
  console.error("Fatal ingestion error:", err);
  process.exit(1);
});
