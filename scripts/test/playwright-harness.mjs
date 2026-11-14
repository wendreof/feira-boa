import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { stageSiteHtml } from "../stage-site-html.mjs";

export const SITE_URL = process.env.SITE_URL || "http://127.0.0.1:8790";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export function repoRootPath() {
  return repoRoot;
}

/**
 * @param {string} url
 * @param {number} [attempts]
 */
export async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server not reachable at ${url}. Start: node scripts/dev-static-server.mjs`);
}

/**
 * @param {string} [probePath]
 * @returns {Promise<null | "started">}
 */
export async function ensureStaticServer(probePath = "/index.html") {
  await stageSiteHtml({ quiet: true });
  const probeUrl = new URL(probePath, SITE_URL).href;
  try {
    const res = await fetch(probeUrl, { signal: AbortSignal.timeout(1500) });
    return res.ok ? null : "started";
  } catch {
    const child = spawn(process.execPath, ["scripts/dev-static-server.mjs"], {
      cwd: repoRoot,
      stdio: "ignore",
      detached: true,
    });
    child.unref();
    return "started";
  }
}

/**
 * @param {import("playwright").Page} page
 */
export async function dismissLoginGate(page) {
  const cancel = page.locator("#login-gate-cancel");
  if (await cancel.isVisible({ timeout: 8000 }).catch(() => false)) {
    await cancel.click();
    await page.locator(".login-prompt").waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }
}