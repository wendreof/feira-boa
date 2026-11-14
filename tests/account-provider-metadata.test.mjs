import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isStorageAvatarPath,
  oauthProviderFromUser,
  providerAvatarUrlFromMetadata,
} from "../src/shared/provider-profile.ts";

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

test("providerAvatarUrlFromMetadata prefers X/Twitter avatar_url over stale Google picture", () => {
  const metadata = {
    picture: "https://lh3.googleusercontent.com/old-google.jpg",
    avatar_url: "https://pbs.twimg.com/profile_images/x.jpg",
  };
  assert.equal(providerAvatarUrlFromMetadata(metadata, "twitter"), "https://pbs.twimg.com/profile_images/x.jpg");
  assert.equal(providerAvatarUrlFromMetadata(metadata, "google"), "https://lh3.googleusercontent.com/old-google.jpg");
});

test("oauthProviderFromUser reads app_metadata and identities", () => {
  assert.equal(oauthProviderFromUser({ app_metadata: { provider: "twitter" } }), "twitter");
  assert.equal(
    oauthProviderFromUser({ identities: [{ provider: "google" }] }),
    "google",
  );
  assert.equal(oauthProviderFromUser(null), null);
});