import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { stageSiteHtml } from "../scripts/stage-site-html.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url));

test("stageSiteHtml copies authored pages to the deploy root", async () => {
  const names = await stageSiteHtml({ quiet: true });
  assert.ok(names.includes("index.html"));
  for (const name of ["index.html", "offline.html"]) {
    const rootHtml = await readFile(path.join(rootDir, name), "utf8");
    const sourceHtml = await readFile(path.join(rootDir, "src", "html", name), "utf8");
    assert.equal(rootHtml, sourceHtml);
  }
});