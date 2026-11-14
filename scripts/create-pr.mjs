import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bodyFile = path.join(repoRoot, ".github", "pull_request_template.md");

const forwarded = process.argv.slice(2);
const args = ["pr", "create", "--base", "develop", "--body-file", bodyFile, ...forwarded];

const result = spawnSync("gh", args, {
  cwd: repoRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
