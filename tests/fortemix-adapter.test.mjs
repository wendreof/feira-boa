import assert from "node:assert/strict";
import test from "node:test";
import { extractForteMix } from "../scripts/adapters/fortemix.mjs";
import { validateSnapshot } from "../scripts/domain/validation.mjs";

test("Forte Mix Sextou flyer transcription produces a valid snapshot", async () => {
  const snapshot = await extractForteMix();
  assert.equal(snapshot.storeId, "fortemix");
  assert.equal(snapshot.store.name, "Forte Mix");
  assert.equal(snapshot.campaignId, "sextou-2026-11-13");
  assert.equal(snapshot.store.from, "2026-11-13");
  assert.equal(snapshot.store.to, "2026-11-13");
  assert.equal(snapshot.offers.length, 32, `expected 32 offers, got ${snapshot.offers.length}`);
  assert.ok(validateSnapshot(snapshot));
  const sample = snapshot.offers.find((o) => o.name.includes("Arroz") && o.name.includes("Prato Fino") && o.price === 28.9);
  assert.ok(sample);
  assert.equal(sample.previousPrice, 31.9);
  assert.match(sample.note, /app/i);
  const gatorade = snapshot.offers.find((o) => o.name.includes("Gatorade"));
  assert.ok(gatorade);
  assert.match(gatorade.note, /Leve 6 pague 5/i);
  const alcatra = snapshot.offers.find((o) => o.name.includes("Alcatra com Maminha"));
  assert.ok(alcatra);
  assert.equal(alcatra.previousPrice, null);
  assert.equal(alcatra.price, 52.9);
});
