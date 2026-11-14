import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildOAuthLoginRedirect,
  oauthProviderUnavailableUserMessage,
  OAUTH_PROVIDER_SCOPES,
  oauthCallbackErrorUserMessage,
} from "../src/shared/oauth-login.ts";

test("buildOAuthLoginRedirect preserves returnTo on login.html", () => {
  const url = buildOAuthLoginRedirect("https://feira-boa.pages.dev", "index.html?view=favorites");
  assert.equal(url, "https://feira-boa.pages.dev/login.html?returnTo=index.html%3Fview%3Dfavorites");
});

test("X OAuth uses Supabase defaults (no extra scopes)", () => {
  assert.equal(OAUTH_PROVIDER_SCOPES.x, undefined);
});

test("oauthCallbackErrorUserMessage explains profile failures", () => {
  const msg = oauthCallbackErrorUserMessage("Error getting user profile from external provider");
  assert.match(msg, /Supabase/);
  assert.match(msg, /Google/);
});

test("oauthProviderUnavailableUserMessage detects disabled provider", () => {
  assert.equal(
    oauthProviderUnavailableUserMessage("x", "Provider not enabled"),
    "O login com X ainda não está disponível. Use seu e-mail e senha.",
  );
  assert.match(
    oauthProviderUnavailableUserMessage("google", "Network error"),
    /^Não foi possível entrar com Google: Network error$/,
  );
});

test("login.html exposes Google and X OAuth controls", () => {
  const html = readFileSync(new URL("../src/html/login.html", import.meta.url), "utf8");
  assert.match(html, /id="google-signin"/);
  assert.match(html, /id="x-signin"/);
  assert.match(html, /Continuar com X/);
});