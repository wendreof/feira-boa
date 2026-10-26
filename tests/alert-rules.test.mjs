import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ALERT_RULES,
  alertsBanner,
  describeRule,
  failureHint,
  parseTargetPrice,
  ruleStatus,
  validateAlertRule,
} from "../src/shared/alert-rules.mjs";

const productTypes = ["Carne bovina", "Hortifruti"];
const stores = ["Corso", "Big Bom"];

test("parseTargetPrice accepts comma and dot decimals", () => {
  assert.equal(parseTargetPrice("12,50"), 12.5);
  assert.equal(parseTargetPrice("12.50"), 12.5);
  assert.equal(parseTargetPrice("1.234,50"), 1234.5);
  assert.ok(Number.isNaN(parseTargetPrice("")));
});

test("validateAlertRule normalizes a valid rule", () => {
  const result = validateAlertRule({ productType: "Carne bovina", store: "", targetPrice: "99,9", productTypes, stores });
  assert.deepEqual(result, { ok: true, value: { product_type: "Carne bovina", store: null, target_price: 99.9 } });
});

test("validateAlertRule rejects unknown product types and stores", () => {
  assert.equal(validateAlertRule({ productType: "Vinho", targetPrice: 10, productTypes, stores }).ok, false);
  assert.equal(validateAlertRule({ productType: "Hortifruti", store: "Loja X", targetPrice: 10, productTypes, stores }).ok, false);
});

test("validateAlertRule rejects non-positive, excessive and over-precise prices", () => {
  assert.equal(validateAlertRule({ productType: "Hortifruti", targetPrice: 0, productTypes }).ok, false);
  assert.equal(validateAlertRule({ productType: "Hortifruti", targetPrice: -3, productTypes }).ok, false);
  assert.equal(validateAlertRule({ productType: "Hortifruti", targetPrice: 10001, productTypes }).ok, false);
  assert.equal(validateAlertRule({ productType: "Hortifruti", targetPrice: 10.555, productTypes }).ok, false);
});

test("validateAlertRule blocks duplicate rules but ignores the rule being edited", () => {
  const rules = [{ id: "a", product_type: "Hortifruti", store: null, target_price: 10, enabled: true }];
  assert.equal(validateAlertRule({ productType: "Hortifruti", targetPrice: 10, rules, productTypes }).ok, false);
  assert.equal(validateAlertRule({ productType: "Hortifruti", targetPrice: 10, rules, productTypes, editingId: "a" }).ok, true);
});

test("validateAlertRule enforces the per-account limit only when creating", () => {
  const rules = Array.from({ length: MAX_ALERT_RULES }, (_, index) => ({
    id: String(index), product_type: "Hortifruti", store: null, target_price: index + 1, enabled: true,
  }));
  assert.equal(validateAlertRule({ productType: "Carne bovina", targetPrice: 5, rules, productTypes }).ok, false);
  assert.equal(validateAlertRule({ productType: "Carne bovina", targetPrice: 5, rules, productTypes, editingId: "0" }).ok, true);
});

test("ruleStatus reports paused and suspended states", () => {
  assert.equal(ruleStatus({ enabled: true }).key, "active");
  assert.equal(ruleStatus({ enabled: true }, { notificationsPaused: true }).key, "suspended");
  assert.equal(ruleStatus({ enabled: false }, { notificationsPaused: true }).key, "paused");
});

test("describeRule falls back to product and any-store labels", () => {
  assert.deepEqual(describeRule({ product_type: null, product: "Arroz", store: null, target_price: 10 }), {
    title: "Arroz", scope: "Qualquer loja", price: describeRule({ target_price: 10 }).price,
  });
  assert.equal(describeRule({ product_type: "Carne bovina", store: "Corso", target_price: 99.76 }).price, "R$ 99,76");
});

test("alertsBanner explains paused, blocked and inactive device states", () => {
  assert.equal(alertsBanner({ activeCount: 0, notificationsPaused: true, deviceEnabled: false }), null);
  assert.equal(alertsBanner({ activeCount: 2, notificationsPaused: true, deviceEnabled: true }).tone, "warning");
  assert.match(alertsBanner({ activeCount: 2, notificationsPaused: false, deviceEnabled: false, permissionDenied: true }).message, /bloqueou/);
  assert.equal(alertsBanner({ activeCount: 2, notificationsPaused: false, deviceEnabled: true }).tone, "ok");
});

test("failureHint maps OneSignal error codes to readable text", () => {
  assert.match(failureHint("onesignal_http_400"), /recusou/);
  assert.match(failureHint("onesignal_api_error"), /conexão/);
  assert.match(failureHint(null), /não identificado/);
});
