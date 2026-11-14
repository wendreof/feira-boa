import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  formatFooterVersionSummary,
  formatSiteVersionPrefix,
  normalizeSemver,
} from "../scripts/domain/site-version-display.mjs";
import { assertSemver } from "../scripts/domain/package-version.mjs";
import { readPackageVersion } from "../scripts/read-package-version.mjs";

test("package.json version is valid semver", async () => {
  const version = await readPackageVersion(new URL("../package.json", import.meta.url));
  assert.equal(version, "1.0.0");
  assert.throws(() => assertSemver("1.0"), /semver/);
});

test("footer version labels use v-prefix and optional build number", () => {
  assert.equal(normalizeSemver("v1.2.3"), "1.2.3");
  assert.equal(formatSiteVersionPrefix("1.0.0"), "v1.0.0");
  assert.equal(formatFooterVersionSummary({ version: "1.0.0" }), "v1.0.0");
  assert.equal(formatFooterVersionSummary({ version: "1.0.0", build: 42 }), "v1.0.0 (build 42)");
});

test("site footer source exposes data-site-version from package version constant", () => {
  const footerTs = readFileSync(new URL("../src/shared/site-footer.ts", import.meta.url), "utf8");
  assert.match(footerTs, /data-site-version="\$\{PACKAGE_VERSION_RAW\}"/);
  assert.match(footerTs, /__SITE_PACKAGE_VERSION__/);
  const siteVersionJs = readFileSync(new URL("../site-version.js", import.meta.url), "utf8");
  assert.match(siteVersionJs, /dataset\.siteVersion/);
});