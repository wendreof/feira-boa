import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  FAVICON_DEFAULT,
  isChristmasSeasonDate,
  parseChristmasSeasonQuery,
  resolveChristmasSeasonEnabled,
  resolveChristmasSeasonForNotifications,
  MANIFEST_DEFAULT,
  PWA_ICON_192_DEFAULT,
  PWA_ICON_QUERY,
  siteAppleTouchIconHref,
  siteFaviconPath,
  siteFaviconUrl,
  siteManifestHref,
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

  it("gates default enablement to 1 Dec–6 Jan", () => {
    assert.equal(resolveChristmasSeasonEnabled({ today: "2026-11-16" }), false);
    assert.equal(resolveChristmasSeasonEnabled({ today: "2026-12-20" }), true);
    assert.equal(resolveChristmasSeasonEnabled({ today: "2027-01-06" }), true);
    assert.equal(resolveChristmasSeasonEnabled({ today: "2027-01-07" }), false);
  });

  it("honors query and storage preview overrides", () => {
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
    assert.equal(
      resolveChristmasSeasonEnabled({ today: "2026-11-16", storageOverride: true }),
      true,
    );
  });

  it("formats São Paulo calendar date for bootstrap", () => {
    const now = new Date("2026-12-20T15:00:00.000Z");
    assert.equal(todayIsoInTimeZone("America/Sao_Paulo", now), "2026-12-20");
  });

  it("resolves notification season like the site theme", () => {
    assert.equal(resolveChristmasSeasonForNotifications({ today: "2026-11-17" }), false);
    assert.equal(resolveChristmasSeasonForNotifications({ today: "2026-12-15" }), true);
    assert.equal(resolveChristmasSeasonForNotifications({ christmas: false }), false);
    assert.equal(resolveChristmasSeasonForNotifications({ christmas: true }), true);
  });

  it("embeds the reference raster in favicon.svg (year-round brand)", async () => {
    const svg = await readFile(new URL("../favicon.svg", import.meta.url), "utf8");
    assert.match(svg, /data:image\/png;base64,/);
    assert.ok(svg.length > 8_000, "favicon.svg should embed the user tile, not the tiny basket SVG");
  });

  it("uses default brand files for favicon, Telegram, and push regardless of season", () => {
    const site = new URL("https://feira-boa.pages.dev/");
    assert.equal(siteFaviconPath({ christmas: true }), `/${FAVICON_DEFAULT}`);
    assert.equal(siteFaviconPath({ christmas: false }), `/${FAVICON_DEFAULT}`);
    assert.equal(
      siteFaviconUrl(site, { christmas: true }),
      `https://feira-boa.pages.dev/${PWA_ICON_192_DEFAULT}${PWA_ICON_QUERY}`,
    );
    const inSeason = sitePushNotificationAssets(site, { christmas: true });
    const offSeason = sitePushNotificationAssets(site, { christmas: false });
    assert.equal(inSeason.icon, "https://feira-boa.pages.dev/icons/notification-96.png");
    assert.equal(inSeason.badge, "https://feira-boa.pages.dev/icons/badge-72.png");
    assert.deepEqual(inSeason, offSeason);
  });

  it("keeps apple-touch and manifest on default icon files year-round", () => {
    assert.equal(siteManifestHref({ christmas: true }), MANIFEST_DEFAULT);
    assert.equal(siteManifestHref({ christmas: false }), MANIFEST_DEFAULT);
    assert.match(siteAppleTouchIconHref({ christmas: true }), /icon-192\.png\?v=/);
    assert.doesNotMatch(siteAppleTouchIconHref({ christmas: true }), /christmas/);
    assert.equal(siteAppleTouchIconHref({ christmas: true }), siteAppleTouchIconHref({ christmas: false }));
  });
});