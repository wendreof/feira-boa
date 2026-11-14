import { test } from "node:test";
import assert from "node:assert/strict";
import { isStorageAvatarPath, providerAvatarUrlFromMetadata } from "../src/shared/provider-profile.ts";

test("isStorageAvatarPath distinguishes storage paths from remote URLs", () => {
  assert.equal(isStorageAvatarPath("user-id/avatar.webp"), true);
  assert.equal(isStorageAvatarPath("https://pbs.twimg.com/profile_images/foo.jpg"), false);
});

test("providerAvatarUrlFromMetadata reads OAuth picture fields", () => {
  assert.equal(
    providerAvatarUrlFromMetadata({ picture: "https://example.com/a.jpg" }),
    "https://example.com/a.jpg",
  );
  assert.equal(providerAvatarUrlFromMetadata({ user_name: "feira" }), null);
  assert.equal(providerAvatarUrlFromMetadata(undefined), null);
});