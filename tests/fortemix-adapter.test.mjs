import assert from "node:assert/strict";
import test from "node:test";
import { extractForteMix } from "../scripts/adapters/fortemix.mjs";
import { validateSnapshot } from "../scripts/domain/validation.mjs";

test("Forte Mix Dezcontão flyer transcription produces a valid snapshot", async () => {
  const snapshot = await extractForteMix();
  assert.equal(snapshot.storeId, "fortemix");
  assert.equal(snapshot.store.name, "Forte Mix");
  assert.equal(snapshot.campaignId, "dezcontao-2026-11-16");
  assert.equal(snapshot.store.from, "2026-11-16");
  assert.equal(snapshot.store.to, "2026-11-16");
  assert.equal(snapshot.offers.length, 27, `expected 27 offers, got ${snapshot.offers.length}`);
  assert.ok(validateSnapshot(snapshot));
  const acucar = snapshot.offers.find((o) => o.name.includes("Açúcar") && o.name.includes("Euroçúcar"));
  assert.ok(acucar);
  assert.equal(acucar.price, 13.98);
  assert.equal(acucar.previousPrice, 17.9);
  assert.match(acucar.note, /app/i);
  const detergente = snapshot.offers.find((o) => o.name.includes("Detergente") && o.name.includes("Limpol"));
  assert.ok(detergente);
  assert.match(detergente.note, /Leve 4 por R\$ 10/i);
  const acem = snapshot.offers.find((o) => o.name.includes("Acém"));
  assert.ok(acem);
  assert.equal(acem.price, 39.9);
  assert.equal(acem.previousPrice, 42.9);
});