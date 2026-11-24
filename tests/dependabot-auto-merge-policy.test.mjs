import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  isDependabotPullRequest,
  isMergeEligible,
} from "../scripts/ci/dependabot-merge-eligible.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("isDependabotPullRequest", () => {
  it("accepts dependabot bot actor", () => {
    assert.equal(
      isDependabotPullRequest({ actor: "dependabot[bot]", headRef: "main" }),
      true,
    );
  });

  it("accepts dependabot head refs", () => {
    assert.equal(
      isDependabotPullRequest({
        actor: "someone",
        headRef: "dependabot/npm_and_yarn/foo-1.2.3",
      }),
      true,
    );
  });

  it("rejects normal contributor PRs", () => {
    assert.equal(
      isDependabotPullRequest({ actor: "wendreof", headRef: "feature/x" }),
      false,
    );
  });
});

describe("isMergeEligible", () => {
  it("allows npm patch and minor", () => {
    assert.equal(
      isMergeEligible({
        updateType: "semver-patch",
        packageEcosystem: "npm",
      }),
      true,
    );
    assert.equal(
      isMergeEligible({
        updateType: "semver-minor",
        packageEcosystem: "npm",
      }),
      true,
    );
    assert.equal(
      isMergeEligible({
        updateType: "version-update:semver-patch",
        packageEcosystem: "npm",
      }),
      true,
    );
  });

  it("blocks semver-major for npm", () => {
    assert.equal(
      isMergeEligible({
        updateType: "semver-major",
        packageEcosystem: "npm",
      }),
      false,
    );
    assert.equal(
      isMergeEligible({
        updateType: "version-update:semver-major",
        packageEcosystem: "npm",
      }),
      false,
    );
  });

  it("rejects npm updates with missing update-type", () => {
    assert.equal(
      isMergeEligible({ updateType: "", packageEcosystem: "npm" }),
      false,
    );
  });

  it("allows github-actions when update-type is absent or non-major", () => {
    assert.equal(
      isMergeEligible({
        updateType: "",
        packageEcosystem: "github-actions",
      }),
      true,
    );
    assert.equal(
      isMergeEligible({
        updateType: "semver-minor",
        packageEcosystem: "github-actions",
      }),
      true,
    );
    assert.equal(
      isMergeEligible({
        updateType: "semver-major",
        packageEcosystem: "github-actions",
      }),
      false,
    );
  });
});

describe("dependabot-auto-merge workflow", () => {
  it("declares dependabot trigger, policy gate, and build-and-test wait", () => {
    const workflowPath = join(
      repoRoot,
      ".github",
      "workflows",
      "dependabot-auto-merge.yml",
    );
    const text = readFileSync(workflowPath, "utf8");
    assert.match(text, /dependabot\[bot\]/);
    assert.match(text, /dependabot\//);
    assert.match(text, /dependabot\/fetch-metadata@v3/);
    assert.match(text, /evaluate-dependabot-merge\.mjs/);
    assert.match(text, /build-and-test/);
    assert.match(text, /gh pr merge/);
    assert.match(text, /--squash/);
    assert.match(text, /auto-merge/);
  });
});