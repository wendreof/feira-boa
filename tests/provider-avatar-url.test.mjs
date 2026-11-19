import assert from "node:assert/strict";
import { test } from "node:test";
import {
  oauthProviderFromUser,
  providerAvatarUrlFromMetadata,
} from "../scripts/domain/provider-avatar-url.mjs";

test("providerAvatarUrlFromMetadata prefers Google picture", () => {
  const url = providerAvatarUrlFromMetadata(
    { picture: "https://lh3.googleusercontent.com/a/foo", name: "Wendreo" },
    "google",
  );
  assert.equal(url, "https://lh3.googleusercontent.com/a/foo");
});

test("oauthProviderFromUser reads app_metadata provider", () => {
  assert.equal(
    oauthProviderFromUser({ app_metadata: { provider: "google" }, identities: [] }),
    "google",
  );
});