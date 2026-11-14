/**
 * Cursor sessionStart: remind agents on develop to sync with main.
 * Fails open — never blocks the session on network or git errors.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const DEVELOP = "develop";
const MAIN_REF = "origin/main";
const FETCH_MS = 8000;

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function git(args, options = {}) {
  return spawnSync("git", args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    ...options,
  });
}

function respond(additionalContext) {
  const payload = additionalContext
    ? JSON.stringify({ additional_context: additionalContext })
    : "{}";
  process.stdout.write(payload);
  process.exit(0);
}

readStdin();

const branch = git(["branch", "--show-current"]);
if (branch.status !== 0 || branch.stdout.trim() !== DEVELOP) {
  respond();
}

const fetch = git(["fetch", "origin", "main"], { timeout: FETCH_MS });
if (fetch.error || fetch.status !== 0) {
  respond(
    "Could not fetch origin/main (offline or timeout). Run `npm run sync:develop` when online before feature work on develop.",
  );
}

if (git(["merge-base", "--is-ancestor", MAIN_REF, "HEAD"]).status !== 0) {
  respond(
    "`develop` is behind `origin/main`. Run `npm run sync:develop` before starting new work.",
  );
}

respond();