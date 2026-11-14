/**
 * @param {string} version
 */
export function normalizeSemver(version) {
  const trimmed = String(version ?? "").trim();
  return trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
}

/**
 * @param {string} version
 */
export function formatSiteVersionPrefix(version) {
  const core = normalizeSemver(version);
  return core ? `v${core}` : "";
}

/**
 * @param {{ version: string, build?: number }} build
 */
export function formatFooterVersionSummary(build) {
  const base = formatSiteVersionPrefix(build.version);
  if (!base) return "Versão";
  const buildNumber = Number(build.build);
  if (Number.isFinite(buildNumber) && buildNumber > 0) {
    return `${base} (build ${buildNumber})`;
  }
  return base;
}