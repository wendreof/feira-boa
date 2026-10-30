import { execFileSync } from "node:child_process";

function gitValue(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/**
 * Identifica a build: commit do ambiente (Cloudflare/GitHub) ou o HEAD local.
 */
export function resolveBuildCommit(env = process.env, git = gitValue) {
  const fromEnv = env.CF_PAGES_COMMIT_SHA ?? env.GITHUB_SHA;
  if (fromEnv) return { commit: fromEnv.slice(0, 7), dirty: false };
  try {
    const dirty = git(["status", "--porcelain"]).length > 0;
    return { commit: git(["rev-parse", "--short=7", "HEAD"]), dirty };
  } catch {
    return { commit: "local", dirty: false };
  }
}

/**
 * Numero sequencial da build: cresce a cada commit (= a cada deploy da branch).
 * Usa o numero da execucao do GitHub Actions quando disponivel.
 */
export function resolveBuildNumber(env = process.env, git = gitValue) {
  const fromEnv = Number.parseInt(env.GITHUB_RUN_NUMBER ?? "", 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  try {
    const count = Number.parseInt(git(["rev-list", "--count", "HEAD"]), 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

export function createBuildInfo({ version, builtAt = new Date().toISOString(), env, git }) {
  const { commit, dirty } = resolveBuildCommit(env, git);
  const build = resolveBuildNumber(env, git);
  return { version, build, commit, builtAt, dirty };
}
