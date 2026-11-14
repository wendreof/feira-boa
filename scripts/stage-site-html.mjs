import { copyFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const htmlSourceDir = path.join(rootDir, "src", "html");

/**
 * Copies authored HTML from src/html/ to the repo root for Cloudflare Pages (output ".").
 */
export async function stageSiteHtml({ quiet = false } = {}) {
  let names;
  try {
    names = (await readdir(htmlSourceDir)).filter((name) => name.endsWith(".html"));
  } catch (error) {
    throw new Error(`Missing HTML source directory ${htmlSourceDir}: ${error.message}`);
  }
  if (names.length === 0) throw new Error(`No .html files under ${htmlSourceDir}`);

  await Promise.all(
    names.map(async (name) => {
      const source = path.join(htmlSourceDir, name);
      const dest = path.join(rootDir, name);
      const info = await stat(source);
      if (!info.isFile()) throw new Error(`${source} is not a file`);
      await copyFile(source, dest);
    }),
  );

  if (!quiet) console.log(`Staged ${names.length} HTML file(s) to site root.`);
  return names;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  await stageSiteHtml();
}