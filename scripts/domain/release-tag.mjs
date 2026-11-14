const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * Git release tag for package.json version (e.g. 1.2.3 → v1.2.3).
 */
export function formatReleaseTag(version) {
  const trimmed = String(version ?? "").trim();
  if (!SEMVER_PATTERN.test(trimmed)) {
    throw new Error(`package.json version must be semver, got: ${trimmed || "(empty)"}`);
  }
  return `v${trimmed}`;
}