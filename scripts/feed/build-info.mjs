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

export function createBuildInfo({ version, builtAt = new Date().toISOString(), env, git }) {
  const { commit, dirty } = resolveBuildCommit(env, git);
  return { version, commit, builtAt, dirty };
}
