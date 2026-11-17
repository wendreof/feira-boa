import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isChristmasSeasonDate,
  parseChristmasSeasonQuery,
  resolveChristmasSeasonEnabled,
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

  it("honors query override over calendar", () => {
    assert.equal(
      resolveChristmasSeasonEnabled({ today: "2026-11-16", queryOverride: true }),
      true,
    );
    assert.equal(
      resolveChristmasSeasonEnabled({ today: "2026-12-20", queryOverride: false }),
      false,
    );
  });

  it("uses São Paulo calendar date by default", () => {
    const now = new Date("2026-12-20T15:00:00.000Z");
    assert.equal(todayIsoInTimeZone("America/Sao_Paulo", now), "2026-12-20");
    assert.equal(resolveChristmasSeasonEnabled({ now }), true);
  });
});