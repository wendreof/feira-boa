import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStartToken } from "../scripts/telegram-client.mjs";

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
