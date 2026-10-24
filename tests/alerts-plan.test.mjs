import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAlertMessage, matchOffersToUsers, offerUrl, pendingNotifications } from "../scripts/alerts/plan.mjs";

const offer = (id, extra = {}) => ({
  id, store: "Alpha", name: "Arroz Tipo 1", productTypes: ["Arroz"], price: 20, validTo: "2026-10-25", ...extra,
});

test("matches an enabled rule to offers at or below the target price", () => {
  const rules = [{ user_id: "u1", store: "Alpha", product_type: "Arroz", target_price: "25" }];
  const offers = [offer("cheap", { price: 20 }), offer("pricey", { price: 30 })];
  const matched = matchOffersToUsers({ rules, offers, activeUserIds: new Set(["u1"]) });
  assert.deepEqual([...matched.get("u1").keys()], ["cheap"]);
});

test("ignores rules of users who paused notifications", () => {
  const rules = [{ user_id: "u1", store: "Alpha", product_type: "Arroz", target_price: "25" }];
  const matched = matchOffersToUsers({ rules, offers: [offer("a")], activeUserIds: new Set() });
  assert.equal(matched.size, 0);
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
  assert.match(message.body, /^Arroz Tipo 1 por R\$\s?19,90 · válida até 2026-10-25\.$/);
});

test("offer link points to the offer on the site", () => {
  assert.equal(offerUrl("https://feira.test/", offer("x y")), "https://feira.test/index.html?offer=x%20y");
});
