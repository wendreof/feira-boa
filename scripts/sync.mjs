import { spawnSync } from "node:child_process";

/**
 * Sincroniza a branch atual com origin/main e regenera os arquivos gerados.
 *
 * Os arquivos gerados (offers.json, bundles) não devem ser mesclados à mão:
 * conflitos neles são resolvidos reconstruindo a partir das fontes. Qualquer
 * outro conflito aborta a mesclagem.
 */
const GENERATED_FILES = [
  "offers.json",
  "offers-jsonld.js",
  "app.js",
  "account.js",
  "admin.js",
  "login.js",
  "stores.js",
  "suggestions.js",
];

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: process.platform === "win32" });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result;
}

function lines(output) {
  return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

function assertCleanTree() {
  const status = lines(run("git", ["status", "--porcelain"]).stdout);
  if (status.length > 0) throw new Error("Working tree has uncommitted changes. Commit or stash them first.");
}

function mergeOriginMain() {
  const merge = run("git", ["merge", "--no-ff", "--no-commit", "origin/main"], { allowFailure: true });
  if (merge.status === 0) return;

  const unmerged = lines(run("git", ["diff", "--name-only", "--diff-filter=U"]).stdout);
  const blocking = unmerged.filter((file) => !GENERATED_FILES.includes(file));
  if (blocking.length > 0) {
    run("git", ["merge", "--abort"]);
    throw new Error(`Manual conflicts, aborted: ${blocking.join(", ")}`);
  }
}

function regenerate() {
  run("npm", ["run", "build"]);
}

function commitGenerated() {
  run("git", ["add", ...GENERATED_FILES]);
  const merging = run("git", ["rev-parse", "-q", "--verify", "MERGE_HEAD"], { allowFailure: true }).status === 0;
  const staged = lines(run("git", ["diff", "--cached", "--name-only"]).stdout);
  if (!merging && staged.length === 0) {
    console.log("Already in sync with origin/main; nothing to commit.");
    return;
  }
  const message = merging ? "Merge origin/main and regenerate offers" : "Regenerate offers";
  run("git", ["commit", "-m", message]);
  console.log(`Committed: ${message}`);
}

assertCleanTree();
run("git", ["fetch", "origin", "main"]);
mergeOriginMain();
regenerate();
commitGenerated();
