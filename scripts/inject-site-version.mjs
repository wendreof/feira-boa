import { readFile, writeFile } from "node:fs/promises";
import { readPackageVersion } from "./read-package-version.mjs";

const rootUrl = new URL("..", import.meta.url);
const packageVersion = await readPackageVersion(new URL("../package.json", import.meta.url));

const buildInfoPath = new URL("../build-info.json", import.meta.url);
try {
  const buildInfo = JSON.parse(await readFile(buildInfoPath, "utf8"));
  if (buildInfo.version !== packageVersion) {
    buildInfo.version = packageVersion;
    await writeFile(buildInfoPath, `${JSON.stringify(buildInfo, null, 2)}\n`);
    console.log(`Updated build-info.json version to ${packageVersion}.`);
  }
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    console.warn("inject-site-version: build-info.json not found yet (run after build-offer-feed).");
  } else {
    throw error;
  }
}

console.log(`Site package version: ${packageVersion} (from package.json).`);