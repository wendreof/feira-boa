import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNotificationRequest, sendNotification, ONESIGNAL_NOTIFICATIONS_URL } from "../scripts/onesignal-client.mjs";

const base = { appId: "app-1", apiKey: "os_v2_app_test", userId: "user-1", title: "T", body: "B", url: "https://example.test/x", collapseId: "c-1" };

function jsonResponse(status, data) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

test("buildNotificationRequest uses the current endpoint, Key auth and push target", () => {
  const { url, init } = buildNotificationRequest(base);
  assert.equal(url, "https://api.onesignal.com/notifications");
  assert.equal(url, ONESIGNAL_NOTIFICATIONS_URL);
  assert.equal(init.method, "POST");
  assert.equal(init.headers.Authorization, "Key os_v2_app_test");
  const body = JSON.parse(init.body);
  assert.equal(body.app_id, "app-1");
  assert.equal(body.target_channel, "push");
  assert.deepEqual(body.include_aliases, { external_id: ["user-1"] });
  assert.equal(body.channel_for_external_user_ids, undefined, "legacy field must not be sent");
});

test("sendNotification returns the recipients count", async () => {
  const fetchImpl = async () => jsonResponse(200, { id: "n", recipients: 2 });
  assert.equal(await sendNotification(base, fetchImpl), 2);
});

test("sendNotification returns 0 when the user has no subscribed device", async () => {
  const fetchImpl = async () => jsonResponse(200, { errors: ["All included players are not subscribed"] });
  assert.equal(await sendNotification(base, fetchImpl), 0);
});

test("sendNotification throws with the HTTP status on auth failures", async () => {
  const fetchImpl = async () => jsonResponse(403, { errors: ["Access denied"] });
  await assert.rejects(sendNotification(base, fetchImpl), (error) => {
    assert.equal(error.onesignalStatus, 403);
    assert.match(error.message, /Access denied/);
    return true;
  });
});
