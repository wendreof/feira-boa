import assert from "node:assert/strict";
import test from "node:test";

import { syncTelegramLinks } from "../scripts/telegram-links.mjs";
import { TelegramApiError } from "../scripts/telegram-client.mjs";

test("syncTelegramLinks exits cleanly when webhook blocks getUpdates", async () => {
  const token = "test-token";
  const siteUrl = new URL("https://feira.test/");
  const supabase = {};

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (String(url).endsWith("/getUpdates")) {
      return new Response(JSON.stringify({
        ok: false,
        description: "Conflict: can't use getUpdates method while webhook is active",
      }), { status: 409, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected fetch: ${url} ${body}`);
  };

  try {
    const counts = await syncTelegramLinks({
      supabase,
      token,
      siteUrl,
      botUsername: "bot",
    });
    assert.equal(counts.mode, "webhook_active");
    assert.equal(counts.updates, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("syncTelegramLinks still throws other Telegram API errors", async () => {
  const error = new TelegramApiError("getUpdates", 401, "Unauthorized");
  assert.throws(() => { throw error; }, /401/);
});
