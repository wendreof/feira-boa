import { readFile } from "node:fs/promises";
import { formatReleaseTag } from "./domain/release-tag.mjs";

const packageInfo = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
process.stdout.write(`${formatReleaseTag(packageInfo.version)}\n`);