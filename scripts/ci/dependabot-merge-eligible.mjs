/** @typedef {'semver-patch' | 'semver-minor' | 'semver-major' | string} DependabotUpdateType */

export const ALLOWED_NPM_UPDATE_TYPES = new Set([
  "semver-patch",
  "semver-minor",
  "version-update:semver-patch",
  "version-update:semver-minor",
]);

export const BLOCKED_UPDATE_TYPES = new Set([
  "semver-major",
  "version-update:semver-major",
]);

/**
 * @param {{ actor?: string; headRef?: string }} input
 */
export function isDependabotPullRequest({ actor, headRef }) {
  const login = (actor ?? "").trim();
  if (login === "dependabot[bot]") {
    return true;
  }
  const ref = (headRef ?? "").trim();
  return ref.startsWith("dependabot/");
}

/**
 * Whether a Dependabot PR should be squash-merged after CI passes.
 *
 * @param {{ updateType?: string; packageEcosystem?: string }} input
 */
export function isMergeEligible({ updateType, packageEcosystem }) {
  const type = (updateType ?? "").trim();
  const ecosystem = (packageEcosystem ?? "").trim().toLowerCase();

  if (BLOCKED_UPDATE_TYPES.has(type)) {
    return false;
  }

  if (ecosystem === "github-actions") {
    if (!type) {
      return true;
    }
    return !BLOCKED_UPDATE_TYPES.has(type);
  }

  if (!type) {
    return false;
  }

  return ALLOWED_NPM_UPDATE_TYPES.has(type);
}