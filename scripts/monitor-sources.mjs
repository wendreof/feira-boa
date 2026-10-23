import { createHash } from "node:crypto";
import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { getWeekValidity, probePagueMenosCatalog } from "./adapters/paguemenos.mjs";

const ROOT = new URL("../", import.meta.url);
export const FEED = new URL("offers.json", ROOT);
export const STATE = new URL(".offer-monitor-state.json", ROOT);
export const STATUS = new URL("source-status.js", ROOT);
export const STATE_DIR = new URL("state/", ROOT);
const OFFERS_TS = new URL("offers.ts", ROOT);
const USER_AGENT = "FeiraBoaOfferMonitor/1.0 (official public flyer change detection)";
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 25 * 1024 * 1024;
const RETRY_DELAYS = [1_000, 3_000];

export function storeKey(store, branch = "") {
  return `${store ?? ""} ${branch ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function loadJson(url, fallback) {
  try {
    return JSON.parse(await readFile(url, "utf8"));
  } catch {
    return fallback;
  }
}

function addSource(sources, name, branch, storeId, sourceUrl) {
  if (typeof sourceUrl !== "string" || !/^https?:\/\//.test(sourceUrl)) return;
  const record = sources.get(sourceUrl) ?? {
    url: sourceUrl,
    store: name ?? "",
    branch: branch ?? "",
    store_id: storeId ?? storeKey(name),
    store_key: storeKey(name, branch),
  };
  if (!record.store && name) record.store = name;
  if (!record.branch && branch) record.branch = branch;
  if (!record.store_id && storeId) record.store_id = storeId;
  if (!record.store_key) record.store_key = storeKey(record.store, record.branch);
  sources.set(sourceUrl, record);
}

export async function collectSources({ feedUrl = FEED, stateDir = STATE_DIR, offersTsUrl = OFFERS_TS } = {}) {
  const sources = new Map();
  const feed = await loadJson(feedUrl, {});
  for (const store of feed.stores ?? []) {
    if (!store || typeof store !== "object") continue;
    addSource(sources, store.name, store.branch, store.storeId, store.sourceUrl);
  }
  try {
    for (const file of await readdir(stateDir)) {
      if (!file.endsWith(".json")) continue;
      const snapshot = await loadJson(new URL(file, stateDir), {});
      const store = snapshot?.store;
      if (!store || typeof store !== "object") continue;
      addSource(sources, store.name, store.branch, snapshot.storeId, store.sourceUrl);
    }
  } catch {
    // state/ is optional while the catalog is still curated only.
  }
  if (sources.size === 0) {
    try {
      const text = await readFile(offersTsUrl, "utf8");
      for (const match of text.matchAll(/sourceUrl:\s*"(https?:\/\/[^"]+)"/g)) {
        addSource(sources, "", "", "", match[1]);
      }
    } catch {
      // No fallback file available.
    }
  }
  return [...sources.values()].sort((a, b) => (a.store_key).localeCompare(b.store_key) || a.url.localeCompare(b.url));
}

export function previousFor(url, source, oldState) {
  if (oldState[url]) return oldState[url];
  const wanted = source.store_key;
  if (!wanted) return null;
  for (const candidate of Object.values(oldState)) {
    if (!candidate || typeof candidate !== "object") continue;
    const key = candidate.store_key || storeKey(candidate.store, candidate.branch);
    if (key === wanted) return candidate;
  }
  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSource(url, fetchImpl = fetch) {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const length = Number(response.headers.get("content-length"));
      if (Number.isFinite(length) && length > MAX_BYTES) throw new Error("Source response exceeded the size limit.");
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length > MAX_BYTES) throw new Error("Source response exceeded the size limit.");
      return {
        body,
        status: response.status,
        content_type: response.headers.get("content-type") ?? "",
        final_url: response.url || url,
      };
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_DELAYS.length) await sleep(RETRY_DELAYS[attempt]);
    }
  }
  throw lastError ?? new Error("Source fetch failed.");
}

/**
 * Sources whose monitored URL is a client-rendered storefront shell cannot be
 * watched by hashing the page: the shell's bytes change on every store redeploy
 * while the offer data lives in a separate catalog API. Hashing such pages
 * flags the source for review forever, for reasons unrelated to the offers.
 * Those sources get a structural probe instead: review is driven by the weekly
 * campaign window, probe failures and URL changes — never by daily price,
 * availability or membership churn, which is exactly what price alerts exist
 * to report on.
 */
async function probePagueMenos(fetchImpl) {
  const { catalog_total } = await probePagueMenosCatalog(fetchImpl);
  const { from, to } = getWeekValidity();
  return { catalog_total, week_window: `${from}/${to}` };
}

const STRUCTURAL_PROBES = new Map([
  ["pague menos", probePagueMenos],
]);

async function monitorStructuralSource(source, previous, probe, fetchImpl) {
  const checkedAt = new Date().toISOString();
  let probeResult;
  try {
    probeResult = await probe(fetchImpl);
  } catch (error) {
    return [{
      ...(previous && typeof previous === "object" ? previous : {}),
      ...source,
      checked_at: checkedAt,
      last_error: error?.name || "FetchError",
      needs_review: previous && typeof previous === "object" ? Boolean(previous.needs_review) : true,
    }, false];
  }
  const weekRotated = Boolean(previous?.week_window) && previous.week_window !== probeResult.week_window;
  const needsReview = previous == null ? true : Boolean(previous.needs_review) || weekRotated;
  return [{
    ...source,
    ...probeResult,
    status: 200,
    content_type: "application/json",
    final_url: source.url,
    checked_at: checkedAt,
    last_success_at: checkedAt,
    last_error: null,
    needs_review: needsReview,
  }, previous == null || weekRotated];
}

export async function monitorSource(source, previous, fetchImpl = fetch) {
  const probe = STRUCTURAL_PROBES.get(String(source.store ?? "").trim().toLowerCase());
  if (probe) return monitorStructuralSource(source, previous, probe, fetchImpl);
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetchSource(source.url, fetchImpl);
    const digest = createHash("sha256").update(response.body).digest("hex");
    const previousDigest = previous?.sha256;
    const changed = Boolean(previousDigest && previousDigest !== digest);
    const needsReview = previous == null ? true : Boolean(previous.needs_review) || changed;
    return [{
      ...source,
      sha256: digest,
      status: response.status,
      content_type: response.content_type,
      final_url: response.final_url,
      checked_at: checkedAt,
      last_success_at: checkedAt,
      last_error: null,
      needs_review: needsReview,
    }, changed];
  } catch (error) {
    return [{
      ...(previous && typeof previous === "object" ? previous : {}),
      ...source,
      checked_at: checkedAt,
      last_error: error?.name || "FetchError",
      needs_review: previous && typeof previous === "object" ? Boolean(previous.needs_review) : true,
    }, false];
  }
}

export function statusPayload(state, sources) {
  const statuses = {};
  const alerts = [];
  for (const source of sources) {
    const entry = state[source.url] ?? {};
    const needsReview = Boolean(entry.needs_review);
    statuses[source.url] = {
      store: entry.store ?? source.store,
      branch: entry.branch ?? source.branch,
      checkedAt: entry.checked_at ?? null,
      lastSuccessAt: entry.last_success_at ?? null,
      error: Boolean(entry.last_error),
      needsReview,
    };
    if (needsReview) {
      alerts.push({
        url: source.url,
        store: entry.store ?? source.store,
        message: "Official source changed; offer details need verification.",
      });
    }
  }
  return { statuses, alerts };
}

export function renderSourceStatus(statuses, alerts) {
  return "// Generated by scripts/monitor-sources.mjs.\n"
    + `window.FEIRA_SOURCE_STATUS = ${JSON.stringify(statuses)};\n`
    + `window.FEIRA_SOURCE_ALERTS = ${JSON.stringify(alerts)};\n`;
}

async function writeJson(url, value) {
  const temporary = new URL(`${url.href}.tmp`);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, url);
}

export async function writeStatus(state, sources, outputUrl = STATUS) {
  const { statuses, alerts } = statusPayload(state, sources);
  await writeFile(outputUrl, renderSourceStatus(statuses, alerts), "utf8");
}

export async function runMonitor({ statusOnly = false, fetchImpl = fetch } = {}) {
  const sources = await collectSources();
  if (sources.length === 0) return { code: 1, message: "No offer sources found." };
  const oldState = await loadJson(STATE, {});
  if (statusOnly) {
    await writeStatus(oldState, sources);
    return { code: 0, message: `Regenerated source-status.js for ${sources.length} source(s).` };
  }
  const newState = {};
  let alerts = 0;
  let failures = 0;
  for (const source of sources) {
    const [entry, changed] = await monitorSource(source, previousFor(source.url, source, oldState), fetchImpl);
    newState[source.url] = entry;
    if (entry.last_error) {
      failures += 1;
      console.log(`WARN ${source.url}: ${entry.last_error}`);
    } else {
      console.log(`OK ${entry.status} ${source.url}${changed ? " [CHANGED]" : ""}`);
    }
    if (entry.needs_review) alerts += 1;
  }
  await writeJson(STATE, newState);
  await writeStatus(newState, sources);
  const message = `Checked ${sources.length} source(s); ${failures} failed; ${alerts} awaiting review.`;
  return { code: failures === sources.length ? 1 : 0, message };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runMonitor({ statusOnly: process.argv.includes("--status-only") });
  console.log(result.message);
  process.exitCode = result.code;
}
