import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const htmlDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/html");

const pages = [
  "index.html",
  "login.html",
  "lojas.html",
  "alerts.html",
  "mensagens.html",
  "suggestions.html",
  "account.html",
  "admin.html",
  "termos.html",
];

const currentPage = new Set(["account.html", "login.html"]);

for (const page of pages) {
  test(`${page} opens the sidebar with the account profile card`, () => {
    const html = fs.readFileSync(path.join(htmlDir, page), "utf8");
    const nav = html.match(/<nav class="sidebar-nav"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav, "sidebar nav missing");
    assert.equal((nav.match(/id="nav-account"/g) ?? []).length, 1);
    assert.match(nav, /^<nav class="sidebar-nav"[^>]*>\s*<a class="sidebar-profile" id="nav-account"/);
    assert.match(nav, /id="topbar-account-image"/);
    assert.match(nav, /id="topbar-account-fallback"/);
    assert.match(nav, /id="sidebar-profile-name"/);
    assert.match(nav, /data-account-label>Entrar</);
    assert.equal(/id="nav-account"[^>]*aria-current="page"/.test(nav), currentPage.has(page));
    assert.doesNotMatch(nav, /<a class="sidebar-link" id="nav-account"/);
  });
}
