import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAlertMessage,
  buildTelegramText,
  formatShortDate,
  matchOffersToUsers,
  offerUrl,
  pendingNotifications,
} from "../scripts/alerts/plan.mjs";

const offer = (id, extra = {}) => ({
  id, store: "Alpha", name: "Arroz Tipo 1", productTypes: ["Arroz"], price: 20, validTo: "2026-10-25", ...extra,
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
  assert.match(message.body, /^Arroz Tipo 1 por R\$\s?19,90 · válida até 2026\/10\/25\.$/);
});

test("offer link points to the offer on the site", () => {
  assert.equal(offerUrl("https://feira.test/", offer("x y")), "https://feira.test/index.html?offer=x%20y");
});

test("short date drops the year and reorders to dd/mm", () => {
  assert.equal(formatShortDate("2026-11-01"), "01/11");
  assert.equal(formatShortDate("bogus"), "bogus");
});

test("telegram text shows product, branch, previous price with discount and short validity", () => {
  const text = buildTelegramText(
    offer("sempre-x", { icon: "🥩", name: "Contrafilé Bovino", store: "Sempre Vale", branch: "Durval Nicolau", price: 49.9, previousPrice: 57.9, validTo: "2026-11-01" }),
    "https://feira.test/",
  );
  const [name, storeLine, priceLine, validity, link, , disclaimer] = text.split("\n");
  assert.equal(name, "🥩 Contrafilé Bovino");
  assert.equal(storeLine, "Sempre Vale · Durval Nicolau");
  assert.match(priceLine, /^R\$\s?49,90 \(antes R\$\s?57,90, −14%\)$/);
  assert.equal(validity, "Válida até 01/11");
  assert.equal(link, "https://feira.test/index.html?offer=sempre-x");
  assert.equal(disclaimer, "Preço do folheto. Confirme na loja.");
});

test("telegram text omits branch, discount and icon when they are absent", () => {
  const text = buildTelegramText(offer("a", { price: 19.9, previousPrice: null, validTo: "2026-10-25" }), "https://feira.test/");
  const lines = text.split("\n");
  assert.equal(lines[0], "Arroz Tipo 1");
  assert.equal(lines[1], "Alpha");
  assert.match(lines[2], /^R\$\s?19,90$/);
  assert.equal(lines[3], "Válida até 25/10");
});

test("telegram text ignores a previous price that is not higher than the current one", () => {
  const text = buildTelegramText(offer("a", { price: 19.9, previousPrice: 19.9 }), "https://feira.test/");
  assert.doesNotMatch(text, /antes/);
});
