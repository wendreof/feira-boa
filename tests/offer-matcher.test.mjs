import test from "node:test";
import assert from "node:assert/strict";
import { formatOfferPrice, getVerifiedActiveOffers, ruleMatchesOffer, saoPauloDate, storeKey } from "../scripts/offer-matcher.mjs";
import { checkSiteHealth, validateBuildInfo, validateOfferFeed } from "../scripts/check-site-health.mjs";

const offer = {
  id: "offer-1",
  store: "Sempre Vale",
  productType: "Bebidas",
  productTypes: ["Bebidas", "Churrasco"],
  name: "Refrigerante",
  price: 7.49,
  validFrom: "2026-10-16",
  validTo: "2026-10-18",
  sourceUrl: "https://store.example/offers",
};

test("uses the São Paulo calendar date for daily matching", () => {
  assert.equal(saoPauloDate(new Date("2026-10-18T02:00:00.000Z")), "2026-10-17");
});

test("only includes active offers from verified, fresh sources", () => {
  const now = Date.parse("2026-10-18T15:00:00Z");
  const verified = { [offer.sourceUrl]: { needs_review: false, last_success_at: "2026-10-18T14:00:00Z" } };
  assert.deepEqual(getVerifiedActiveOffers([offer], verified, "2026-10-18", now), [offer]);
  assert.deepEqual(getVerifiedActiveOffers([offer], verified, "2026-10-19", now), []);
  assert.deepEqual(getVerifiedActiveOffers([offer], {}, "2026-10-18", now), []);
  assert.deepEqual(getVerifiedActiveOffers([offer], { [offer.sourceUrl]: { needs_review: true, last_success_at: "2026-10-18T14:00:00Z" } }, "2026-10-18", now), []);
  assert.deepEqual(getVerifiedActiveOffers([offer], { [offer.sourceUrl]: { needs_review: false, last_success_at: "2026-10-17T10:00:00Z" } }, "2026-10-18", now), []);
  assert.deepEqual(getVerifiedActiveOffers([offer], { [offer.sourceUrl]: { needs_review: false } }, "2026-10-18", now), []);
});

test("falls back to the store identity when the flyer URL rotates", () => {
  const now = Date.parse("2026-10-18T15:00:00Z");
  const refreshedStore = {
    "https://store.example/new-flyer": {
      store: "Sempre Vale",
      branch: "Durval Nicolau",
      store_key: storeKey("Sempre Vale", "Durval Nicolau"),
      needs_review: false,
      last_success_at: "2026-10-18T14:00:00Z",
    },
  };
  const withBranch = { ...offer, branch: "Durval Nicolau" };
  assert.deepEqual(getVerifiedActiveOffers([withBranch], refreshedStore, "2026-10-18", now), [withBranch]);
});

test("matches store, product type, and target price", () => {
  assert.equal(ruleMatchesOffer({ store: "Sempre Vale", product_type: "Bebidas", target_price: 8 }, offer), true);
  assert.equal(ruleMatchesOffer({ product_type: "Churrasco", target_price: 8 }, offer), true);
  assert.equal(ruleMatchesOffer({ store: "Big Bom", product_type: "Bebidas", target_price: 8 }, offer), false);
  assert.equal(ruleMatchesOffer({ product_type: "Bebidas", target_price: 7 }, offer), false);
});

test("formats prices in Brazilian reais", () => {
  assert.equal(formatOfferPrice(7.49), "R$ 7,49");
});

test("site health check validates public HTML and data files", async () => {
  const now = Date.parse("2026-10-18T15:00:00Z");
  const feed = { schemaVersion: 1, updatedAt: "2026-10-18T14:00:00Z", stores: [{}], offers: [offer] };
  const buildInfo = { version: "1.0.0", commit: "abc1234", builtAt: "2026-10-18T14:00:00Z", dirty: false };
  const manifest = { name: "Feira Boa", start_url: "/", icons: [{ sizes: "192x192" }, { sizes: "512x512" }] };
  const fetchStub = async (url) => {
    if (url.pathname.endsWith("offers.json")) return Response.json(feed);
    if (url.pathname.endsWith("build-info.json")) return Response.json(buildInfo);
    if (url.pathname.endsWith("manifest.webmanifest")) return Response.json(manifest);
    if (url.pathname.endsWith("service-worker.js")) return new Response('self.addEventListener("fetch", () => {}); importScripts("/onesignal/OneSignalSDKWorker.js");');
    if (url.pathname.endsWith("source-status.js")) return new Response("window.FEIRA_SOURCE_STATUS = {};");
    if (url.pathname.includes("/onesignal/")) return new Response("/* OneSignal SDK */", { status: 200, headers: { "content-type": "text/javascript" } });
    return new Response("<!doctype html><title>Feira Boa</title>", {
      status: 200,
      headers: {
        "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=()",
        "cross-origin-opener-policy": "same-origin",
      },
    });
  };
  assert.deepEqual(await checkSiteHealth("https://feira.example/", fetchStub, { now, requireSecurityHeaders: true }), {
    host: "feira.example",
    filesChecked: 8,
    offers: 1,
    commit: "abc1234",
    feedUpdatedAt: "2026-10-18T14:00:00Z",
  });
  assert.doesNotThrow(() => validateOfferFeed(feed, { now }));
  assert.doesNotThrow(() => validateBuildInfo(buildInfo, { expectedCommit: "abc1234567890" }));
  assert.throws(() => validateOfferFeed(feed, { now: now + 25 * 60 * 60 * 1000 }), /stale/);
});
