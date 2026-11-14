import { readFile } from "node:fs/promises";
import { assertSemver } from "./domain/package-version.mjs";

/**
 * @param {URL | string} packageJsonUrl
 */
export async function readPackageVersion(packageJsonUrl) {
  const url = packageJsonUrl instanceof URL ? packageJsonUrl : new URL(packageJsonUrl, import.meta.url);
  const packageInfo = JSON.parse(await readFile(url, "utf8"));
  const version = packageInfo?.version;
  assertSemver(version);
  return version.trim();
}