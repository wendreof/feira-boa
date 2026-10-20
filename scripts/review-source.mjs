import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const stateUrl = new URL("../.offer-monitor-state.json", import.meta.url);
const state = JSON.parse(await readFile(stateUrl, "utf8"));
const args = process.argv.slice(2);
const all = args.includes("--all");
const urlIndex = args.indexOf("--url");
const storeIndex = args.indexOf("--store");
const url = urlIndex >= 0 ? args[urlIndex + 1] : null;
const store = storeIndex >= 0 ? args[storeIndex + 1] : null;

if (!all && !url && !store) {
  console.error("Usage: npm run review:source -- --all | --url <source-url> | --store <store-name>");
  process.exit(1);
}

let reviewed = 0;
for (const [sourceUrl, entry] of Object.entries(state)) {
  const matches = all
    || sourceUrl === url
    || (store && [entry.store, entry.store_id, entry.store_key].filter(Boolean).some((value) => String(value).toLowerCase() === store.toLowerCase()));
  if (!matches) continue;
  entry.needs_review = false;
  reviewed += 1;
}

if (reviewed === 0) {
  console.error("No matching source found.");
  process.exit(1);
}

await writeFile(stateUrl, `${JSON.stringify(state, null, 2)}\n`, "utf8");
const statusWriter = fileURLToPath(new URL("./write-source-status.mjs", import.meta.url));
const result = spawnSync(process.execPath, [statusWriter], { stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Marked ${reviewed} source(s) as reviewed.`);
