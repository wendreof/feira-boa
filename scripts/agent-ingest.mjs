import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const STORE_TESTS = {
  sempre: ["tests/adapters.test.mjs"],
  bigbom: ["tests/adapters.test.mjs"],
  corso: ["tests/corso-adapter.test.mjs", "tests/adapters.test.mjs"],
  paguemenos: ["tests/adapters.test.mjs"],
  spasso: ["tests/spasso-flyer-images.test.mjs", "tests/spasso-adapter.test.mjs"],
  spani: ["tests/adapters.test.mjs"],
  fortemix: ["tests/fortemix-adapter.test.mjs"],
};

const argStoreIdx = process.argv.indexOf("--store");
const store = argStoreIdx >= 0 ? process.argv[argStoreIdx + 1]?.trim() : null;

function runNode(args, label) {
  console.log(`\n>> ${label}`);
  execFileSync(process.execPath, args, { stdio: "inherit" });
}

const ingestScript = fileURLToPath(new URL("./ingest-offers.mjs", import.meta.url));
const ingestArgs = [ingestScript];
if (store && store !== "all") {
  ingestArgs.push("--store", store);
}

runNode(ingestArgs, store ? `ingest:offers --store ${store}` : "ingest:offers (all stores)");

const tests = new Set(["tests/offer-feed.test.mjs"]);
if (store && store !== "all") {
  for (const file of STORE_TESTS[store] ?? []) tests.add(file);
} else {
  tests.add("tests/fortemix-adapter.test.mjs");
  tests.add("tests/adapters.test.mjs");
  tests.add("tests/spasso-flyer-images.test.mjs");
  tests.add("tests/spasso-adapter.test.mjs");
  tests.add("tests/corso-adapter.test.mjs");
}

runNode(["--test", ...tests], `node --test ${[...tests].join(" ")}`);
console.log("\nAgent ingest pipeline finished OK.");
