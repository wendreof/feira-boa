import assert from "node:assert/strict";
import test from "node:test";
import {
  formatWeekdaySpotLabel,
  inferSpassoWeekdaysFromCategory,
  inferSpassoWeekdaysFromFlyerUrl,
  isSpassoSectionBannerName,
  parseSpassoFlyerFilenameDates,
  parseWeekdaysFromPortugueseText,
  resolveSpassoCampaignWeekdays,
  spassoCampaignOfferValidity,
  spassoEncarteWindow,
  weekdaysBetweenCalendarDates,
} from "../scripts/domain/spasso-weekday-validity.mjs";
import { isOfferActive } from "../scripts/domain/offer-validity.mjs";

test("parseSpassoFlyerFilenameDates reads dated PNG names", () => {
  assert.deepEqual(
    parseSpassoFlyerFilenameDates(
      "https://spassosabores.com.br/wp-content/uploads/2026/11/SPASSO-FLV-17-A-18-11-2026.png",
    ),
    { from: "2026-11-17", to: "2026-11-18" },
  );
});

test("flyer URL and category infer Spasso weekday spots", () => {
  assert.deepEqual(inferSpassoWeekdaysFromFlyerUrl("https://x/SPASSO-FLV-3-A-4-11-2026.png"), [2, 3]);
  assert.deepEqual(inferSpassoWeekdaysFromFlyerUrl("https://x/SPASSO-ACOGUE-4-A-6-11-2026.png"), [3, 4, 5]);
  assert.deepEqual(inferSpassoWeekdaysFromCategory("Hortifruti"), [2, 3]);
  assert.deepEqual(inferSpassoWeekdaysFromCategory("Carnes"), [3, 4, 5]);
});

test("parseWeekdaysFromPortugueseText reads day names without numeric dates", () => {
  assert.deepEqual(parseWeekdaysFromPortugueseText("Terça e Quarta do Hortifruti"), [2, 3]);
  assert.deepEqual(parseWeekdaysFromPortugueseText("Quarta a Sexta do Açougue"), [3, 4, 5]);
});

test("weekdaysBetweenCalendarDates captures short Gemini windows", () => {
  assert.deepEqual(weekdaysBetweenCalendarDates("2026-11-03", "2026-11-04"), [2, 3]);
  assert.deepEqual(weekdaysBetweenCalendarDates("2026-11-04", "2026-11-06"), [3, 4, 5]);
});

test("hortifruti campaign is active on terça but not on quinta within encarte week", () => {
  const campaign = {
    from: "2026-11-03",
    to: "2026-11-04",
    offers: [{ cat: "Hortifruti", name: "Banana", price: 1 }],
  };
  const urls = ["https://spassosabores.com.br/wp-content/uploads/2026/11/SPASSO-FLV-3-A-4-11-2026.png"];
  const validity = spassoCampaignOfferValidity(campaign, urls, new Date("2026-11-17T15:00:00Z"));
  assert.deepEqual(validity.validWeekdays, [2, 3]);
  assert.equal(validity.from, "2026-11-16");
  assert.equal(validity.to, "2026-11-21");

  const offer = { validFrom: validity.from, validTo: validity.to, validWeekdays: validity.validWeekdays };
  assert.equal(isOfferActive(offer, "2026-11-17"), true, "terça");
  assert.equal(isOfferActive(offer, "2026-11-18"), true, "quarta");
  assert.equal(isOfferActive(offer, "2026-11-19"), false, "quinta");
});

test("spassoEncarteWindow spans Monday through Saturday", () => {
  const window = spassoEncarteWindow(new Date("2026-11-17T15:00:00Z"));
  assert.equal(window.from, "2026-11-16");
  assert.equal(window.to, "2026-11-21");
});

test("resolveSpassoCampaignWeekdays prefers explicit campaign weekdays", () => {
  const days = resolveSpassoCampaignWeekdays(
    { weekdays: ["quarta", "sexta"], offers: [{ cat: "Hortifruti" }] },
    [],
  );
  assert.deepEqual(days, [3, 5]);
});

test("isSpassoSectionBannerName drops weekday headers", () => {
  assert.equal(isSpassoSectionBannerName("Terça e Quarta do Hortifruti"), true);
  assert.equal(isSpassoSectionBannerName("Banana Prata"), false);
});

test("formatWeekdaySpotLabel", () => {
  assert.equal(formatWeekdaySpotLabel([2, 3]), "ter–qua");
});