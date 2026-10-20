import { collectSources, writeStatus } from "./monitor-sources.mjs";
import { readFile } from "node:fs/promises";

const state = JSON.parse(await readFile(new URL("../.offer-monitor-state.json", import.meta.url), "utf8"));
const sources = await collectSources();
await writeStatus(state, sources);
console.log(`Generated source-status.js for ${sources.length} source(s).`);
