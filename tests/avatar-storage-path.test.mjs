import test from "node:test";
import assert from "node:assert/strict";

import { isStorageAvatarPath } from "../scripts/domain/avatar-storage-path.mjs";

test("isStorageAvatarPath treats bucket paths as storage", () => {
  assert.equal(isStorageAvatarPath("user-1/avatar.webp"), true);
  assert.equal(isStorageAvatarPath("  user-1/avatar.jpg  "), true);
});

test("isStorageAvatarPath treats remote OAuth URLs as non-storage", () => {
  assert.equal(isStorageAvatarPath("https://lh3.googleusercontent.com/a/photo"), false);
  assert.equal(isStorageAvatarPath("http://example.com/x.png"), false);
});