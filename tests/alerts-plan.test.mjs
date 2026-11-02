import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAlertMessage,
  buildTelegramDigestText,
  buildTelegramReplyMarkup,
  buildTelegramText,
  expiryHighlightForAlerts,
  formatShortDate,
  matchOffersToUsers,
  offerUrl,
  partitionTelegramDelivery,
  pendingNotifications,
} from "../scripts/alerts/plan.mjs";

const offer = (id, extra = {}) => ({
  id, store: "Alpha", name: "Arroz Tipo 1", productTypes: ["Arroz"], price: 20, validFrom: "2026-10-20", validTo: "2026-10-25", ...extra,
});

test("matches an enabled rule to offers at or below the target price", () => {
  const rules = [{ user_id: "u1", store: "Alpha", product_type: "Arroz", target_price: "25" }];
  const offers = [offer("cheap", { price: 20 }), offer("pricey", { price: 30 })];
  const matched = matchOffersToUsers({ rules, offers });
  assert.deepEqual([...matched.get("u1").keys()], ["cheap"]);
});

test("pending notifications skip pairs already sent", () => {
  const matched = new Map([["u1", new Map([["a", offer("a")], ["b", offer("b")]])]]);
  const pending = pendingNotifications(matched, new Set(["u1:a"]));
  assert.deepEqual(pending.map((item) => item.offer.id), ["b"]);
  assert.equal(pending[0].userId, "u1");
});

test("alert message carries store, product, price and validity", () => {
  const message = buildAlertMessage(offer("a", { price: 19.9 }));
  assert.equal(message.title, "Alpha: oferta para você");
  assert.match(message.body, /^Arroz Tipo 1 por R\$\s?19,90 · válida até 25\/10\/2026\.$/);
});

test("offer link points to the offer on the site", () => {
  assert.equal(offerUrl("https://feira.test/", offer("x y")), "https://feira.test/index.html?offer=x%20y");
});

test("short date drops the year and reorders to dd/mm", () => {
  assert.equal(formatShortDate("2026-11-01"), "01/11");
  assert.equal(formatShortDate("bogus"), "bogus");
});

test("telegram text uses store name, expiry highlight and no raw link line", () => {
  const text = buildTelegramText(
    offer("sempre-x", { icon: "🥩", name: "Contrafilé Bovino", store: "Sempre Vale", branch: "Durval Nicolau", price: 49.9, previousPrice: 57.9, validTo: "2026-11-01" }),
    "https://feira.test/",
    "2026-11-01",
  );
  const lines = text.split("\n");
  assert.equal(lines[0], "🥩 Contrafilé Bovino");
  assert.equal(lines[1], "Sempre Vale");
  assert.match(lines[2], /^R\$\s?49,90 \(antes R\$\s?57,90, −14%\)$/);
  assert.equal(lines[3], "Válida até 01/11");
  assert.equal(lines[4], "Último dia");
  assert.doesNotMatch(text, /index\.html\?offer=/);
});

test("telegram text omits branch, discount and icon when they are absent", () => {
  const text = buildTelegramText(offer("a", { price: 19.9, previousPrice: null, validTo: "2026-10-25" }), "https://feira.test/", "2026-10-22");
  const lines = text.split("\n");
  assert.equal(lines[0], "Arroz Tipo 1");
  assert.equal(lines[1], "Alpha");
  assert.match(lines[2], /^R\$\s?19,90$/);
  assert.equal(lines[3], "Válida até 25/10");
});

test("telegram text ignores a previous price that is not higher than the current one", () => {
  const text = buildTelegramText(offer("a", { price: 19.9, previousPrice: 19.9 }), "https://feira.test/", "2026-10-22");
  assert.doesNotMatch(text, /antes/);
});

test("telegram reply markup opens the offer on the site", () => {
  const markup = buildTelegramReplyMarkup(offer("a"), "https://feira.test/");
  assert.equal(markup.inline_keyboard[0][0].url, "https://feira.test/index.html?offer=a");
});

test("partitionTelegramDelivery caps per user and builds digest list", () => {
  const pending = [
    { userId: "u1", offer: offer("1") },
    { userId: "u1", offer: offer("2") },
    { userId: "u1", offer: offer("3") },
    { userId: "u2", offer: offer("4") },
  ];
  const { immediate, digests } = partitionTelegramDelivery(pending, 2);
  assert.equal(immediate.length, 3);
  assert.equal(digests.length, 1);
  assert.equal(digests[0].offers.length, 1);
  assert.equal(digests[0].offers[0].name, "Arroz Tipo 1");
  assert.match(buildTelegramDigestText(digests[0].offers, "https://feira.test/"), /alertas\.html/);
  assert.match(buildTelegramDigestText(digests[0].offers, "https://feira.test/"), /Arroz Tipo 1/);
});

test("expiryHighlightForAlerts flags tomorrow", () => {
  assert.equal(expiryHighlightForAlerts({ validFrom: "2026-11-01", validTo: "2026-11-02" }, "2026-11-01"), "Expira amanhã");
});
