import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { avatarPublicUrl, AVATAR_BUCKET, SUPABASE_PROJECT_URL } from "../scripts/domain/avatar-public-url.mjs";

describe("avatar-public-url", () => {
  it("builds a sized render URL", () => {
    const url = avatarPublicUrl("user-a/avatar.webp", 64);
    assert.ok(url.startsWith(`${SUPABASE_PROJECT_URL}/storage/v1/render/image/public/${AVATAR_BUCKET}/`));
    assert.ok(url.includes("user-a/avatar.webp"));
    assert.ok(url.includes("width=64"));
    assert.ok(url.includes("height=64"));
    assert.ok(url.includes("resize=cover"));
  });

  it("builds a full-size object URL", () => {
    const url = avatarPublicUrl("user-a/avatar.webp");
    assert.equal(
      url,
      `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${AVATAR_BUCKET}/user-a/avatar.webp`,
    );
  });
});
