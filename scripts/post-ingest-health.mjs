import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWithRetry } from "./adapters/http.mjs";
import { USER_AGENT } from "./adapters/gemini-flyer.mjs";
import { discoverCorsoFlyerFromHtml } from "./domain/corso-flyer.mjs";
import { discoverSpassoFlyersFromHtml } from "./domain/spasso-flyer.mjs";
import { flyerCacheHashProblems } from "./domain/flyer-cache-health.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const STATE_DIR = new URL("../state/", import.meta.url);
const DATA_DIR = join(ROOT, "scripts/adapters/data");
const AUTO_STORES = ["paguemenos", "bigbom", "spani"];
const MAX_AGE_MS = 30 * 60 * 60 * 1000;

const VISION_CACHE_STORES = [
  {
    id: "spasso",
    pageUrl: "https://spassosabores.com.br/ofertas-sao-joao/",
    cacheFile: "spasso-campaigns.json",
    discover: discoverSpassoFlyersFromHtml,
  },
  {
    id: "corso",
    pageUrl: "https://corso.com.br/jornalfrente.php",
    cacheFile: "corso-campaigns.json",
    discover: discoverCorsoFlyerFromHtml,
  },
];

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

async function fetchHtml(url) {
  const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${url} failed (${res.status})`);
  return res.text();
}

async function visionCacheProblems() {
  const problems = [];
  for (const store of VISION_CACHE_STORES) {
    const html = await fetchHtml(store.pageUrl);
    const live = store.discover(html);
    const cache = JSON.parse(await readFile(join(DATA_DIR, store.cacheFile), "utf8"));
    problems.push(...flyerCacheHashProblems(store.id, live?.hash ?? null, cache.flyerHash ?? null));
  }
  return problems;
}

const problems = [];

for (const id of AUTO_STORES) {
  const snap = await loadSnapshot(id);
  if (!snap?.offers?.length) problems.push(`${id}: no offers in snapshot`);
  else if (ageMs(snap.fetchedAt) > MAX_AGE_MS) problems.push(`${id}: snapshot older than 30h (${snap.fetchedAt})`);
}

try {
  problems.push(...(await visionCacheProblems()));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  problems.push(`vision-cache: ${message}`);
}

if (problems.length) {
  console.error("Post-ingest health checks failed:");
  for (const line of problems) console.error(`- ${line}`);
  process.exit(1);
}

console.log("Post-ingest health checks passed.");