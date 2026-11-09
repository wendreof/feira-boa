import assert from "node:assert/strict";
import test from "node:test";
import { extractForteMix } from "../scripts/adapters/fortemix.mjs";
import { validateSnapshot } from "../scripts/domain/validation.mjs";

test("Forte Mix Dezcontão flyer transcription produces a valid snapshot", async () => {
  const snapshot = await extractForteMix();
  assert.equal(snapshot.storeId, "fortemix");
  assert.equal(snapshot.store.name, "Forte Mix");
  assert.equal(snapshot.campaignId, "dezcontao-app-2026-11-09");
  assert.equal(snapshot.store.from, "2026-11-09");
  assert.equal(snapshot.store.to, "2026-11-09");
  assert.ok(snapshot.offers.length >= 28, `expected at least 28 offers, got ${snapshot.offers.length}`);
  assert.ok(validateSnapshot(snapshot));
  const sample = snapshot.offers.find((o) => o.name.includes("Café Grão da Terra") && o.price === 15.98);
  assert.ok(sample);
  assert.equal(sample.previousPrice, 22.98);
  assert.match(sample.note, /app/i);
  const bundle = snapshot.offers.find((o) => o.name.includes("Salgadinho Torcida"));
  assert.ok(bundle);
  assert.match(bundle.note, /Leve 4 por/i);
});
