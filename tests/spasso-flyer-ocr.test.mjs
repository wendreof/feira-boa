import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  parseSpassoFlyerOcrText,
  pickSpassoExtractionWinner,
} from "../scripts/domain/spasso-flyer-ocr.mjs";

test("parseSpassoFlyerOcrText extracts priced products from OCR fixture", async () => {
  const sample = await readFile(
    fileURLToPath(new URL("./fixtures/spasso-flyer-ocr-sample.txt", import.meta.url)),
    "utf8",
  );
  const campaigns = parseSpassoFlyerOcrText(sample);
  const total = campaigns.reduce((sum, campaign) => sum + campaign.offers.length, 0);
  assert.ok(total >= 8, `expected at least 8 offers, got ${total}`);
  const pessego = campaigns.flatMap((c) => c.offers).find((o) => /pêssego/i.test(o.name));
  assert.ok(pessego);
  assert.equal(pessego.price, 1.79);
  assert.equal(pessego.cat, "Hortifruti");
  const contra = campaigns.flatMap((c) => c.offers).find((o) => /contrafil/i.test(o.name));
  assert.ok(contra);
  assert.equal(contra.cat, "Carnes");
});

test("pickSpassoExtractionWinner prefers higher offer count", () => {
  const ocr = [{ offers: [{ name: "A" }, { name: "B" }] }];
  const gemini = [{ offers: [{ name: "A" }] }];
  const picked = pickSpassoExtractionWinner({ ocr, gemini, minGemini: 20 });
  assert.equal(picked.extractionMethod, "ocr");
  assert.equal(picked.campaigns, ocr);
});

test("pickSpassoExtractionWinner uses gemini when it meets threshold and beats ocr", () => {
  const ocr = [{ offers: [{ name: "A" }] }];
  const gemini = Array.from({ length: 21 }, (_, index) => ({
    offers: [{ name: `Item ${index}` }],
  }));
  const picked = pickSpassoExtractionWinner({ ocr, gemini, minGemini: 20 });
  assert.equal(picked.extractionMethod, "gemini");
  assert.equal(picked.campaigns, gemini);
});