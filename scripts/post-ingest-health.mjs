import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const STATE_DIR = new URL("../state/", import.meta.url);
const AUTO_STORES = ["paguemenos", "bigbom", "spani"];
const MAX_AGE_MS = 30 * 60 * 60 * 1000;

async function loadSnapshot(id) {
  try {
    return JSON.parse(await readFile(new URL(`${id}.json`, STATE_DIR), "utf8"));
  } catch {
    return null;
  }
}

function ageMs(fetchedAt) {
  if (!fetchedAt) return Number.POSITIVE_INFINITY;
  const t = Date.parse(fetchedAt);
  return Number.isFinite(t) ? Date.now() - t : Number.POSITIVE_INFINITY;
}

const problems = [];

for (const id of AUTO_STORES) {
  const snap = await loadSnapshot(id);
  if (!snap?.offers?.length) problems.push(`${id}: no offers in snapshot`);
  else if (ageMs(snap.fetchedAt) > MAX_AGE_MS) problems.push(`${id}: snapshot older than 30h (${snap.fetchedAt})`);
}

if (problems.length) {
  console.error("Post-ingest health checks failed:");
  for (const line of problems) console.error(`- ${line}`);
  process.exit(1);
}

console.log("Post-ingest health checks passed.");
