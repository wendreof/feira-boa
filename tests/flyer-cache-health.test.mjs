import assert from "node:assert/strict";
import test from "node:test";
import { flyerCacheHashProblems } from "../scripts/domain/flyer-cache-health.mjs";

test("flyerCacheHashProblems passes when hashes match", () => {
  assert.deepEqual(flyerCacheHashProblems("spasso", "abc", "abc"), []);
});

test("flyerCacheHashProblems flags stale cache", () => {
  const problems = flyerCacheHashProblems("spasso", "live123", "cache456");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /stale/);
  assert.match(problems[0], /live123/);
});