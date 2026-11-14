import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ADSENSE_CLIENT_ID,
  ADSENSE_CSP_READY,
  adsTxtLine,
  adsenseDecision,
  adsenseScriptSrc,
} from "../scripts/domain/adsense.mjs";

const CLIENT = "ca-pub-1234567890123456";
const LIVE_CLIENT = "ca-pub-7989265241424368";

test("a missing or invalid client never enables ads", () => {
  assert.equal(adsenseDecision({ clientId: "", cspReady: true }).reason, "missing-client");
  assert.equal(adsenseDecision({ clientId: "pub-1", cspReady: true }).reason, "missing-client");
  assert.equal(adsenseDecision({ clientId: CLIENT, cspReady: false }).reason, "csp");
});

test("a ready free visit sees an ad only on offer and store pages", () => {
  const ready = { clientId: CLIENT, cspReady: true };
  assert.deepEqual(adsenseDecision({ ...ready, page: "index.html" }), {
    enabled: true,
    clientId: CLIENT,
    page: "index.html",
  });
  assert.equal(adsenseDecision({ ...ready, page: "/lojas.html?x=1" }).page, "lojas.html");
  assert.equal(adsenseDecision({ ...ready, page: "" }).page, "index.html");
  assert.equal(adsenseDecision({ ...ready, plan: "plus" }).reason, "plus");
  for (const page of ["admin.html", "login.html", "alerts.html", "account.html", "termos.html"]) {
    assert.equal(adsenseDecision({ ...ready, page }).reason, "page", page);
  }
});

test("ads.txt line uses the publisher id and Google's certification authority", () => {
  assert.equal(adsTxtLine(""), "");
  assert.equal(
    adsTxtLine(CLIENT),
    "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0",
  );
});

test("the live site loads auto ads on offer pages and names them in the privacy section", () => {
  assert.equal(ADSENSE_CLIENT_ID, LIVE_CLIENT);
  assert.equal(ADSENSE_CSP_READY, true);
  assert.equal(adsenseDecision().enabled, true);
  assert.equal(adsenseDecision({ plan: "plus" }).reason, "plus");
  const src = adsenseScriptSrc();
  assert.equal(src, `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${LIVE_CLIENT}`);
  for (const file of ["index.html", "lojas.html"]) {
    const html = readFileSync(new URL(`../src/html/${file}`, import.meta.url), "utf8");
    assert.match(html, new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const file of ["termos.html", "login.html", "admin.html", "alerts.html", "account.html"]) {
    const html = readFileSync(new URL(`../src/html/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(html, /adsbygoogle|ca-pub-/);
  }
  const terms = readFileSync(new URL("../src/html/termos.html", import.meta.url), "utf8");
  assert.match(terms, /id="privacidade"/);
  assert.match(terms, /exibem anúncios do Google \(AdSense\)/);
  assert.match(terms, /https:\/\/adssettings\.google\.com/);
  const footerSource = readFileSync(new URL("../src/shared/site-footer.ts", import.meta.url), "utf8");
  assert.match(footerSource, /termos\.html#privacidade/);
  assert.match(footerSource, /data-site-version/);
  const headers = readFileSync(new URL("../_headers", import.meta.url), "utf8");
  assert.match(headers, /script-src 'self' https:\/\/pagead2\.googlesyndication\.com/);
  assert.match(headers, /frame-src https:\/\/googleads\.g\.doubleclick\.net/);
  const adsTxt = readFileSync(new URL("../ads.txt", import.meta.url), "utf8").trim();
  assert.equal(adsTxt, adsTxtLine(LIVE_CLIENT));
});
