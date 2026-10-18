import { pathToFileURL } from "node:url";

export function validateOfferFeed(feed) {
  if (feed?.schemaVersion !== 1 || !Array.isArray(feed.offers) || !Array.isArray(feed.stores)) {
    throw new Error("offers.json has an invalid shape.");
  }
  if (!Number.isFinite(Date.parse(feed.updatedAt)) || feed.offers.length === 0) {
    throw new Error("offers.json has no valid update date or offers.");
  }
  const ids = new Set();
  for (const offer of feed.offers) {
    if (!offer.id || ids.has(offer.id) || !Number.isFinite(offer.price) || offer.price <= 0) {
      throw new Error("offers.json has a missing/duplicate ID or invalid price.");
    }
    ids.add(offer.id);
  }
}

export function validateBuildInfo(buildInfo) {
  if (!buildInfo?.version || !buildInfo.commit || !Number.isFinite(Date.parse(buildInfo.builtAt))) {
    throw new Error("build-info.json has an invalid shape.");
  }
}

export async function checkSiteHealth(siteUrlValue, fetchImpl = fetch) {
  const siteUrl = new URL(siteUrlValue);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(siteUrl.hostname);
  if (siteUrl.protocol !== "https:" && !(isLocal && siteUrl.protocol === "http:")) {
    throw new Error("SITE_URL must use HTTPS (HTTP is allowed only for local checks).");
  }
  if (siteUrl.search || siteUrl.hash) throw new Error("SITE_URL must not include a query or fragment.");
  const base = siteUrl.href.endsWith("/") ? siteUrl : new URL(`${siteUrl.href}/`);
  const files = ["index.html", "offers.json", "build-info.json"];
  const responses = await Promise.all(files.map(async (file) => {
    const response = await fetchImpl(new URL(file, base), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`${file} returned HTTP ${response.status}.`);
    return [file, response];
  }));
  const content = Object.fromEntries(await Promise.all(responses.map(async ([file, response]) => [
    file,
    file.endsWith(".json") ? await response.json() : await response.text(),
  ])));
  if (!content["index.html"].toLowerCase().includes("feira boa")) throw new Error("index.html does not contain the Feira Boa site.");
  validateOfferFeed(content["offers.json"]);
  validateBuildInfo(content["build-info.json"]);
  return { host: siteUrl.host, filesChecked: files.length, offers: content["offers.json"].offers.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) throw new Error("SITE_URL is required.");
  const result = await checkSiteHealth(siteUrl);
  console.log(JSON.stringify({ status: "ok", ...result }));
}
