import { appendFileSync } from "node:fs";
import { isMergeEligible } from "./dependabot-merge-eligible.mjs";

const updateType = process.env.UPDATE_TYPE ?? "";
const packageEcosystem = process.env.PACKAGE_ECOSYSTEM ?? "";
const eligible = isMergeEligible({ updateType, packageEcosystem });

const line = `eligible=${eligible ? "true" : "false"}`;
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`);
}

console.log(
  `Dependabot merge policy: ecosystem=${packageEcosystem || "(empty)"} update-type=${updateType || "(empty)"} eligible=${eligible}`,
);

process.exit(0);