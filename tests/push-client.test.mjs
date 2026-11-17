import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPushPayload,
  buildPushPayloadForOffer,
  pushErrorCode,
  readVapidConfig,
  subscriptionFromRow,
} from "../scripts/push-client.mjs";
import { VAPID_PUBLIC_KEY } from "../scripts/domain/vapid-config.mjs";

test("readVapidConfig requires private key and falls back to committed public key", () => {
  assert.equal(readVapidConfig({}), null);
  const config = readVapidConfig({ VAPID_PRIVATE_KEY: "priv-test" });
  assert.ok(config);
  assert.equal(config.publicKey, VAPID_PUBLIC_KEY);
  assert.equal(config.privateKey, "priv-test");
  assert.match(config.subject, /^mailto:/);
});

test("buildPushPayload serializes notification fields", () => {
  const payload = JSON.parse(buildPushPayload({ title: "T", body: "B", url: "https://x.test/o", tag: "offer-1" }));
  assert.deepEqual(payload, { title: "T", body: "B", url: "https://x.test/o", tag: "offer-1" });
});

test("buildPushPayload adds seasonal icon URLs when siteUrl is set", () => {
  const siteUrl = new URL("https://feira.test/");
  const payload = JSON.parse(buildPushPayload({
    title: "T",
    body: "B",
    url: "https://feira.test/",
    siteUrl,
    christmas: true,
  }));
  assert.match(payload.icon, /notification-christmas-96\.png$/);
  assert.match(payload.badge, /badge-christmas-72\.png$/);
});

test("buildPushPayloadForOffer uses offer link", () => {
  const siteUrl = new URL("https://feira-boa.pages.dev/");
  const offer = { id: "abc-123", store: "Loja", name: "Item", price: 9.99, validTo: "2026-11-02" };
  const payload = JSON.parse(buildPushPayloadForOffer({ offer, siteUrl, title: "T", body: "B" }));
  assert.match(payload.url, /index\.html\?offer=abc-123/);
  assert.equal(payload.tag, "abc-123");
});

test("pushErrorCode maps expired subscriptions", () => {
  assert.equal(pushErrorCode({ statusCode: 410 }), "push_subscription_gone");
  assert.equal(pushErrorCode({ statusCode: 404 }), "push_subscription_gone");
  assert.equal(pushErrorCode({ statusCode: 429 }), "push_http_429");
  assert.equal(pushErrorCode(new Error("x")), "push_api_error");
});

test("subscriptionFromRow maps database columns", () => {
  assert.deepEqual(subscriptionFromRow({
    endpoint: "https://push.test/end",
    p256dh: "dh",
    auth_key: "auth",
  }), {
    endpoint: "https://push.test/end",
    keys: { p256dh: "dh", auth: "auth" },
  });
});
