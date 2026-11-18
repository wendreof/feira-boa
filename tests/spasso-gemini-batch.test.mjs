import assert from "node:assert/strict";
import test from "node:test";
import { chunkFlyerImageUrls } from "../scripts/adapters/spasso-gemini.mjs";

test("chunkFlyerImageUrls splits Spasso encarte URLs for smaller Gemini payloads", () => {
  const urls = ["a", "b", "c", "d", "e", "f"];
  assert.deepEqual(chunkFlyerImageUrls(urls, 2), [
    ["a", "b"],
    ["c", "d"],
    ["e", "f"],
  ]);
});