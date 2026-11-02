import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyPublishedLogos,
  logoUrlForStoreId,
  logoUrlForStoreName,
  MAIN_STORE_IDS,
} from "../src/shared/store-logos.mjs";

test("main store logos are self-hosted paths", () => {
  for (const storeId of MAIN_STORE_IDS) {
    const url = logoUrlForStoreId(storeId);
    assert.match(url, /^logos\/[a-z0-9-]+\.png$/);
  }
});

test("applyPublishedLogos rewrites store and offer logos for monitored groceries", () => {
  const snapshotsByStore = new Map([
    ["semprevale", { storeId: "semprevale", store: { name: "Sempre Vale" } }],
  ]);
  const { stores, offers } = applyPublishedLogos({
    stores: [{
      name: "Sempre Vale",
      branch: "Centro",
      logo: "https://example.com/old.png",
      sourceUrl: "https://example.com/",
      from: "2026-10-01",
      to: "2026-10-31",
    }],
    offers: [{
      id: "x",
      store: "Sempre Vale",
      storeLogo: "https://example.com/old.png",
    }],
    snapshotsByStore,
  });
  assert.equal(stores[0].logo, "logos/semprevale.png");
  assert.equal(offers[0].storeLogo, "logos/semprevale.png");
  assert.equal(logoUrlForStoreName("Big Bom"), "logos/bigbom.png");
});
