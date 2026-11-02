import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTelegramBotCopy, parseStartToken } from "../supabase/functions/_shared/telegram-updates.mjs";

test("parseStartToken reads deep-link tokens", () => {
  assert.equal(parseStartToken("/start abcDEF1234567890"), "abcDEF1234567890");
  assert.equal(parseStartToken("/start@feiraboapagesdev_bot token123456789012"), "token123456789012");
  assert.equal(parseStartToken("/start"), null);
});

test("buildTelegramBotCopy includes alerts page URL", () => {
  const copy = buildTelegramBotCopy(new URL("https://feira.test/"), "feiraboapagesdev_bot");
  assert.match(copy.help, /alertas\.html/);
  assert.match(copy.linked(2), /2 alerta\(s\) ativo\(s\)/);
});
