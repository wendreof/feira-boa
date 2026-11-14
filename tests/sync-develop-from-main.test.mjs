import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMergeConflictMessage } from "../scripts/domain/sync-develop-messages.mjs";

describe("formatMergeConflictMessage", () => {
  it("lists conflicting paths", () => {
    const message = formatMergeConflictMessage(["README.md", "package.json"]);
    assert.match(message, /README\.md/);
    assert.match(message, /package\.json/);
    assert.match(message, /aborted due to conflicts/);
  });

  it("handles an empty conflict list", () => {
    const message = formatMergeConflictMessage([]);
    assert.match(message, /unknown files/);
  });
});