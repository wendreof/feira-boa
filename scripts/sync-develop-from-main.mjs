import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatMergeConflictMessage } from "./domain/sync-develop-messages.mjs";

const DEVELOP_BRANCH = "develop";
const MAIN_REF = "origin/main";

/**
 * Fetches origin/main, ensures the develop branch, and merges origin/main.
 * Aborts with a clear message when the working tree is dirty or merge conflicts appear.
 */
function run(command, args, { allowFailure = false, input } = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    input,
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result;
}

function lines(output) {
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

function currentBranch() {
  return run("git", ["branch", "--show-current"]).stdout.trim();
}

function assertCleanTree() {
  const status = lines(run("git", ["status", "--porcelain"]).stdout);
  if (status.length > 0) {
    throw new Error("Working tree has uncommitted changes. Commit or stash them before syncing.");
  }
}

function refExists(ref) {
  return run("git", ["rev-parse", "--verify", ref], { allowFailure: true }).status === 0;
}

function ensureDevelop() {
  if (currentBranch() === DEVELOP_BRANCH) {
    return;
  }

  if (refExists(DEVELOP_BRANCH)) {
    run("git", ["checkout", DEVELOP_BRANCH]);
    return;
  }

  if (refExists(`origin/${DEVELOP_BRANCH}`)) {
    run("git", ["checkout", "-B", DEVELOP_BRANCH, `origin/${DEVELOP_BRANCH}`]);
    return;
  }

  throw new Error(
    `Branch '${DEVELOP_BRANCH}' not found locally or on origin. Create it or run: git fetch origin ${DEVELOP_BRANCH}`,
  );
}

function mergeOriginMain() {
  if (run("git", ["merge-base", "--is-ancestor", MAIN_REF, "HEAD"], { allowFailure: true }).status === 0) {
    console.log(`${DEVELOP_BRANCH} already includes ${MAIN_REF}.`);
    return;
  }

  const merge = run("git", ["merge", "--no-edit", MAIN_REF], { allowFailure: true });
  if (merge.status === 0) {
    console.log(`Merged ${MAIN_REF} into ${DEVELOP_BRANCH}.`);
    return;
  }

  const unmerged = lines(run("git", ["diff", "--name-only", "--diff-filter=U"], { allowFailure: true }).stdout);
  run("git", ["merge", "--abort"]);
  throw new Error(formatMergeConflictMessage(unmerged));
}

function main() {
  assertCleanTree();
  run("git", ["fetch", "origin", "main"]);
  run("git", ["fetch", "origin", DEVELOP_BRANCH], { allowFailure: true });
  ensureDevelop();
  mergeOriginMain();
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}