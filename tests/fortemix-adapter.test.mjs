import assert from "node:assert/strict";
import test from "node:test";
import { extractForteMix } from "../scripts/adapters/fortemix.mjs";
import { validateSnapshot } from "../scripts/domain/validation.mjs";

test("Forte Mix Festival Felitá transcription produces a valid snapshot", async () => {
  const snapshot = await extractForteMix();
  assert.equal(snapshot.storeId, "fortemix");
  assert.equal(snapshot.store.name, "Forte Mix");
  assert.equal(snapshot.campaignId, "festival-felita-2026-11-03");
  assert.equal(snapshot.store.from, "2026-11-03");
  assert.equal(snapshot.store.to, "2026-11-16");
  assert.ok(snapshot.offers.length >= 35, `expected ~36 offers, got ${snapshot.offers.length}`);
  assert.ok(validateSnapshot(snapshot));
  const sample = snapshot.offers.find((o) => o.name.includes("Café") && o.price === 19.98);
  assert.ok(sample);
  assert.equal(sample.previousPrice, 22.9);
  assert.match(sample.note, /app/i);
});
