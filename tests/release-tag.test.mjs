import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatReleaseTag } from "../scripts/domain/release-tag.mjs";

describe("formatReleaseTag", () => {
  it("prefixes v to semver", () => {
    assert.equal(formatReleaseTag("1.2.3"), "v1.2.3");
  });

  it("accepts prerelease and build metadata", () => {
    assert.equal(formatReleaseTag("2.0.0-beta.1"), "v2.0.0-beta.1");
    assert.equal(formatReleaseTag("2.0.0+build.1"), "v2.0.0+build.1");
  });

  it("rejects invalid versions", () => {
    assert.throws(() => formatReleaseTag(""), /semver/);
    assert.throws(() => formatReleaseTag("1.2"), /semver/);
    assert.throws(() => formatReleaseTag("latest"), /semver/);
  });
});