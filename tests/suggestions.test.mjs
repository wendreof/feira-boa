import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSuggestionRow,
  detectSuggestionGuard,
  submitSuggestion,
  SUGGESTION_GUARD_MESSAGES,
} from "../suggestions.ts";

function createFakeClient() {
  const inserted = [];
  const client = {
    from(table) {
      assert.equal(table, "suggestions");
      return {
        insert(row) {
          inserted.push(row);
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };
  return { client, inserted };
}

function createFailingClient(error) {
  const client = {
    from() {
      return {
        insert() {
          return Promise.resolve({ data: null, error });
        },
      };
    },
  };
  return client;
}

test("buildSuggestionRow sends the signed-in account as user_id", () => {
  const row = buildSuggestionRow({
    category: "bug",
    message: "  O formulário não salva  ",
    userId: "user-123",
    honeypot: "",
  });

  assert.equal(row.user_id, "user-123");
  assert.equal(row.category, "bug");
  assert.equal(row.message, "O formulário não salva");
  assert.equal(row.honeypot, "");
});

test("buildSuggestionRow keeps the honeypot value so the server can reject it", () => {
  const row = buildSuggestionRow({
    category: "idea",
    message: "Mensagem com dez ou mais caracteres",
    userId: "user-123",
    honeypot: "http://spam.example",
  });

  assert.equal(row.honeypot, "http://spam.example");
});

test("submitSuggestion inserts the row with user_id and honeypot", async () => {
  const { client, inserted } = createFakeClient();

  await submitSuggestion(client, {
    category: "idea",
    message: "Sugestão com tamanho suficiente",
    userId: "user-42",
    honeypot: "",
  });

  assert.equal(inserted.length, 1);
  assert.deepEqual(inserted[0], {
    category: "idea",
    message: "Sugestão com tamanho suficiente",
    user_id: "user-42",
    honeypot: "",
  });
});

test("submitSuggestion throws the database error", async () => {
  const failure = { message: SUGGESTION_GUARD_MESSAGES.cooldown };
  const client = createFailingClient(failure);

  await assert.rejects(
    () =>
      submitSuggestion(client, {
        category: "other",
        message: "Mensagem com tamanho suficiente",
        userId: "user-42",
        honeypot: "",
      }),
    (error) => error === failure,
  );
});

test("detectSuggestionGuard recognizes every server guard", () => {
  assert.equal(detectSuggestionGuard({ message: SUGGESTION_GUARD_MESSAGES.honeypot }), "honeypot");
  assert.equal(detectSuggestionGuard({ message: SUGGESTION_GUARD_MESSAGES.cooldown }), "cooldown");
  assert.equal(detectSuggestionGuard({ message: SUGGESTION_GUARD_MESSAGES.dailyLimit }), "dailyLimit");
  assert.equal(detectSuggestionGuard({ message: SUGGESTION_GUARD_MESSAGES.signIn }), "signIn");
});

test("detectSuggestionGuard ignores unrelated failures", () => {
  assert.equal(detectSuggestionGuard({ message: "connection reset" }), null);
  assert.equal(detectSuggestionGuard(null), null);
  assert.equal(detectSuggestionGuard(new Error("boom")), null);
});
