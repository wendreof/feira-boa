import { pathToFileURL } from "node:url";

export const MAX_FEED_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function validateOfferFeed(feed, { now = Date.now(), maxAgeMs = MAX_FEED_AGE_MS } = {}) {
  if (feed?.schemaVersion !== 1 || !Array.isArray(feed.offers) || !Array.isArray(feed.stores)) {
    throw new Error("offers.json has an invalid shape.");
  }
  const updatedAt = Date.parse(feed.updatedAt);
  if (!Number.isFinite(updatedAt) || feed.offers.length === 0) {
    throw new Error("offers.json has no valid update date or offers.");
  }
  if (now - updatedAt > maxAgeMs) throw new Error(`offers.json is stale (updatedAt=${feed.updatedAt}).`);
  if (updatedAt - now > MAX_CLOCK_SKEW_MS) throw new Error("offers.json has an update date in the future.");
  const ids = new Set();
  for (const offer of feed.offers) {
    if (!offer.id || ids.has(offer.id) || !Number.isFinite(offer.price) || offer.price <= 0) {
      throw new Error("offers.json has a missing/duplicate ID or invalid price.");
    }
    ids.add(offer.id);
  }
}

export function validateBuildInfo(buildInfo, { expectedCommit = null, requireClean = false } = {}) {
  if (!buildInfo?.version || !buildInfo.commit || !Number.isFinite(Date.parse(buildInfo.builtAt))) {
    throw new Error("build-info.json has an invalid shape.");
  }
  if (requireClean && buildInfo.dirty === true) throw new Error("build-info.json was built from a dirty worktree.");
  if (expectedCommit && !String(expectedCommit).startsWith(buildInfo.commit)) {
    throw new Error(`Deployed commit ${buildInfo.commit} does not match expected ${String(expectedCommit).slice(0, 7)}.`);
  }
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || !manifest.name || !manifest.start_url || !Array.isArray(manifest.icons)) {
    throw new Error("manifest.webmanifest has an invalid shape.");
  }
  const sizes = new Set(manifest.icons.map((icon) => icon.sizes));
  if (!sizes.has("192x192") || !sizes.has("512x512")) throw new Error("manifest.webmanifest is missing required icon sizes.");
}

export async function checkSiteHealth(siteUrlValue, fetchImpl = fetch, {
  expectedCommit = null,
  requireClean = false,
  requireSecurityHeaders = false,
  now = Date.now(),
  maxFeedAgeMs = MAX_FEED_AGE_MS,
} = {}) {
  const siteUrl = new URL(siteUrlValue);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(siteUrl.hostname);
  if (siteUrl.protocol !== "https:" && !(isLocal && siteUrl.protocol === "http:")) {
    throw new Error("SITE_URL must use HTTPS (HTTP is allowed only for local checks).");
  }
  if (siteUrl.search || siteUrl.hash) throw new Error("SITE_URL must not include a query or fragment.");
  const base = siteUrl.href.endsWith("/") ? siteUrl : new URL(`${siteUrl.href}/`);
  const files = ["index.html", "offers.json", "build-info.json", "service-worker.js", "manifest.webmanifest", "source-status.js"];
  const responses = await Promise.all(files.map(async (file) => {
    const response = await fetchImpl(new URL(file, base), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`${file} returned HTTP ${response.status}.`);
    return [file, response];
  }));
  const content = Object.fromEntries(await Promise.all(responses.map(async ([file, response]) => [
    file,
    file.endsWith(".json") || file.endsWith(".webmanifest") ? await response.json() : await response.text(),
  ])));
  if (!content["index.html"].toLowerCase().includes("feira boa")) throw new Error("index.html does not contain the Feira Boa site.");
  if (!content["service-worker.js"].includes('addEventListener("fetch"')) throw new Error("service-worker.js has no fetch handler.");
  if (!content["service-worker.js"].includes('addEventListener("push"')) throw new Error("service-worker.js has no push handler.");
  if (!content["source-status.js"].includes("FEIRA_SOURCE_STATUS")) throw new Error("source-status.js is missing status data.");
  validateOfferFeed(content["offers.json"], { now, maxAgeMs: maxFeedAgeMs });
  validateBuildInfo(content["build-info.json"], { expectedCommit, requireClean });
  validateManifest(content["manifest.webmanifest"]);

  if (requireSecurityHeaders) {
    const headers = responses.find(([file]) => file === "index.html")?.[1].headers;
    for (const name of [
      "content-security-policy",
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
      "permissions-policy",
      "cross-origin-opener-policy",
    ]) {
      if (!headers?.get(name)) throw new Error(`Missing security header: ${name}.`);
    }
    const csp = headers.get("content-security-policy") ?? "";
    for (const directive of ["default-src", "script-src", "style-src", "frame-ancestors"]) {
      if (!csp.includes(directive)) throw new Error(`Content-Security-Policy is missing ${directive}.`);
    }
  }

  return {
    host: siteUrl.host,
    filesChecked: files.length,
    offers: content["offers.json"].offers.length,
    commit: content["build-info.json"].commit,
    feedUpdatedAt: content["offers.json"].updatedAt,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) throw new Error("SITE_URL is required.");
  const result = await checkSiteHealth(siteUrl, fetch, {
    expectedCommit: process.env.EXPECTED_COMMIT || null,
    requireClean: process.env.NODE_ENV === "production" || Boolean(process.env.REQUIRE_CLEAN_BUILD),
    requireSecurityHeaders: process.env.REQUIRE_SECURITY_HEADERS === "1",
  });
  console.log(JSON.stringify({ status: "ok", ...result }));
}
