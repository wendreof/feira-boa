import assert from "node:assert/strict";
import test from "node:test";
import { extractForteMix } from "../scripts/adapters/fortemix.mjs";
import { validateSnapshot } from "../scripts/domain/validation.mjs";

test("Forte Mix WhatsApp flyer transcription produces a valid snapshot", async () => {
  const snapshot = await extractForteMix();
  assert.equal(snapshot.storeId, "fortemix");
  assert.equal(snapshot.store.name, "Forte Mix");
  assert.equal(snapshot.campaignId, "fortemix-2026-11-17");
  assert.equal(snapshot.store.from, "2026-11-17");
  assert.equal(snapshot.store.to, "2026-11-30");
  assert.equal(snapshot.offers.length, 61, `expected 61 offers, got ${snapshot.offers.length}`);
  assert.ok(validateSnapshot(snapshot));
  const laranja = snapshot.offers.find((o) => o.name.includes("Laranja Lima"));
  assert.ok(laranja);
  assert.equal(laranja.price, 1.28);
  assert.equal(laranja.previousPrice, 3.99);
  assert.match(laranja.note, /app/i);
  const cafeFelita = snapshot.offers.find(
    (o) => o.name.includes("Café") && o.name.includes("Felitá"),
  );
  assert.ok(cafeFelita);
  assert.equal(cafeFelita.price, 16.9);
  assert.match(cafeFelita.note, /Leve 2.*2ª un R\$ 16,90/i);
  const gelatinaBulk = snapshot.offers.find(
    (o) => o.name.includes("Gelatina") && o.name.includes("Felitá"),
  );
  assert.ok(gelatinaBulk);
  assert.equal(gelatinaBulk.price, 1.19);
  assert.match(gelatinaBulk.note, /A partir de 3 un/i);
  const costela = snapshot.offers.find((o) => o.name.includes("Costela Minga"));
  assert.ok(costela);
  assert.equal(costela.price, 26.98);
});