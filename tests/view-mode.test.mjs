import test from "node:test";
import assert from "node:assert/strict";
import { resolveDefaultViewMode } from "../view-mode.js";

test("mobile viewport forces list mode", () => {
  assert.equal(resolveDefaultViewMode("grid", true), "list");
  assert.equal(resolveDefaultViewMode("list", true), "list");
  assert.equal(resolveDefaultViewMode(null, true), "list");
});

test("desktop keeps saved mode or falls back to grid", () => {
  assert.equal(resolveDefaultViewMode("list", false), "list");
  assert.equal(resolveDefaultViewMode("grid", false), "grid");
  assert.equal(resolveDefaultViewMode(null, false), "grid");
});
