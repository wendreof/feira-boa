const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * @param {string} version
 */
export function assertSemver(version) {
  if (typeof version !== "string" || !SEMVER_RE.test(version.trim())) {
    throw new Error(`package.json version must be valid semver (got ${JSON.stringify(version)}).`);
  }
}