import { execFileSync } from "node:child_process";
import { formatReleaseTag } from "./domain/release-tag.mjs";
import { readPackageVersion } from "./domain/read-package-version.mjs";

const version = await readPackageVersion(new URL("../package.json", import.meta.url));
const tag = formatReleaseTag(version);

try {
  const existing = execFileSync("git", ["tag", "--list", tag], { encoding: "utf8" }).trim();
  if (existing === tag) {
    console.error(`Git tag ${tag} already exists. Bump package.json version first.`);
    process.exit(1);
  }
} catch (error) {
  console.error("git-tag-release: git is required and this must run inside the repository.");
  process.exit(1);
}

console.log(`Create an annotated release tag matching package.json:\n  git tag -a ${tag} -m "Release ${tag}"\n  git push origin ${tag}`);