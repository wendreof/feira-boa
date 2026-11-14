import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SUPABASE_AUTH_STORAGE_KEY,
  readStoredAuthUserId,
} from "../scripts/domain/supabase-auth-storage.mjs";

test("readStoredAuthUserId reads only the Feira Boa storage key", () => {
  const storage = {
    values: new Map([
      ["sb-preview-other-auth-token", JSON.stringify({ access_token: "x", user: { id: "wrong-user" } })],
      [SUPABASE_AUTH_STORAGE_KEY, JSON.stringify({ access_token: "ok", user: { id: "feira-user" } })],
    ]),
    getItem(key) {
      return this.values.get(key) ?? null;
    },
  };

  assert.equal(readStoredAuthUserId(storage), "feira-user");
});

test("readStoredAuthUserId ignores expired sessions", () => {
  const storage = {
    values: new Map([
      [
        SUPABASE_AUTH_STORAGE_KEY,
        JSON.stringify({
          access_token: "ok",
          user: { id: "feira-user" },
          expires_at: Math.floor(Date.now() / 1000) - 60,
        }),
      ],
    ]),
    getItem(key) {
      return this.values.get(key) ?? null;
    },
  };

  assert.equal(readStoredAuthUserId(storage), null);
});