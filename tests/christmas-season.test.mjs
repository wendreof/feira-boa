import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FAVICON_CHRISTMAS,
  FAVICON_DEFAULT,
  isChristmasSeasonDate,
  parseChristmasSeasonQuery,
  resolveChristmasSeasonEnabled,
  resolveChristmasSeasonForNotifications,
  siteFaviconPath,
  siteFaviconUrl,
  sitePushNotificationAssets,
  todayIsoInTimeZone,
} from "../scripts/domain/christmas-season.mjs";

describe("christmas-season", () => {
  it("marks 1 Dec through 6 Jan as in season", () => {
    assert.equal(isChristmasSeasonDate("2026-11-30"), false);
    assert.equal(isChristmasSeasonDate("2026-12-01"), true);
    assert.equal(isChristmasSeasonDate("2026-12-25"), true);
    assert.equal(isChristmasSeasonDate("2027-01-06"), true);
    assert.equal(isChristmasSeasonDate("2027-01-07"), false);
  });

  it("parses ?christmas query override", () => {
    assert.equal(parseChristmasSeasonQuery(new URLSearchParams("christmas=1")), true);
    assert.equal(parseChristmasSeasonQuery(new URLSearchParams("christmas=off")), false);
    assert.equal(parseChristmasSeasonQuery(new URLSearchParams("")), null);
  });

  it("honors query and storage opt-out", () => {
    assert.equal(resolveChristmasSeasonEnabled({ today: "2026-11-16" }), true);
    assert.equal(
      resolveChristmasSeasonEnabled({ today: "2026-11-16", queryOverride: true }),
      true,
    );
    assert.equal(
      resolveChristmasSeasonEnabled({ today: "2026-12-20", queryOverride: false }),
      false,
    );
    assert.equal(
      resolveChristmasSeasonEnabled({ today: "2026-12-20", storageOverride: false }),
      false,
    );
  });

  it("formats São Paulo calendar date for bootstrap", () => {
    const now = new Date("2026-12-20T15:00:00.000Z");
    assert.equal(todayIsoInTimeZone("America/Sao_Paulo", now), "2026-12-20");
  });

  it("resolves notification season like the site theme", () => {
    assert.equal(resolveChristmasSeasonForNotifications({ today: "2026-11-17" }), true);
    assert.equal(resolveChristmasSeasonForNotifications({ christmas: false }), false);
  });

  it("builds favicon and push asset URLs from SITE_URL", () => {
    const site = new URL("https://feira-boa.pages.dev/");
    assert.equal(siteFaviconPath({ christmas: true }), `/${FAVICON_CHRISTMAS}`);
    assert.equal(siteFaviconPath({ christmas: false }), `/${FAVICON_DEFAULT}`);
    assert.equal(siteFaviconUrl(site, { christmas: true }), "https://feira-boa.pages.dev/favicon-christmas.svg");
    const assets = sitePushNotificationAssets(site, { christmas: true });
    assert.equal(assets.icon, "https://feira-boa.pages.dev/icons/notification-christmas-96.png");
    assert.equal(assets.badge, "https://feira-boa.pages.dev/icons/badge-christmas-72.png");
  });
});