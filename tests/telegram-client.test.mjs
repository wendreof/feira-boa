import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStartToken, sendTelegramMessage } from "../scripts/telegram-client.mjs";

const TOKEN = "AbC_123-xyzABC_123-xyz";

test("parseStartToken reads the token from /start deep links", () => {
  assert.equal(parseStartToken(`/start ${TOKEN}`), TOKEN);
  assert.equal(parseStartToken(`/start@feira_bot ${TOKEN}`), TOKEN);
  assert.equal(parseStartToken(`  /start ${TOKEN}  `), TOKEN);
});

test("parseStartToken ignores messages without a valid token", () => {
  assert.equal(parseStartToken("/start"), null);
  assert.equal(parseStartToken("oi"), null);
  assert.equal(parseStartToken("/start curto"), null);
  assert.equal(parseStartToken(`/start ${TOKEN} extra`), null);
  assert.equal(parseStartToken(undefined), null);
});

test("sendTelegramMessage disables link previews and never sends a custom preview URL", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), body: JSON.parse(String(init.body)) };
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await sendTelegramMessage(TOKEN, 123, "https://feira-boa.pages.dev/index.html", {
      replyMarkup: { inline_keyboard: [] },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(captured.url, /\/sendMessage$/);
  assert.equal(captured.body.disable_web_page_preview, true);
  assert.deepEqual(captured.body.link_preview_options, { is_disabled: true });
  assert.equal(captured.body.link_preview_options.url, undefined);
  assert.equal("url" in (captured.body.link_preview_options), false);
});
