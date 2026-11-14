import assert from "node:assert/strict";
import test from "node:test";
import { decodeHtmlEntities } from "../scripts/domain/html-entities.mjs";
import { discoverCorsoFlyerFromHtml } from "../scripts/domain/corso-flyer.mjs";
import { discoverSpassoFlyersFromHtml } from "../scripts/domain/spasso-flyer.mjs";

test("decodeHtmlEntities leaves plain strings untouched", () => {
  const raw = "https://example.com/foo.png";
  assert.equal(decodeHtmlEntities(raw), raw);
});

test("decodeHtmlEntities decodes common named and numeric references", () => {
  assert.equal(decodeHtmlEntities("a&amp;b"), "a&b");
  assert.equal(decodeHtmlEntities("&quot;hi&quot;"), '"hi"');
  assert.equal(decodeHtmlEntities("&#231;"), "ç");
});

test("discoverSpassoFlyersFromHtml discovers flyer src after entity decoding", () => {
  const html = `
    <p>Ofertas &amp; promo&ccedil;&otilde;es</p>
    <img src="https://spassosabores.com.br/wp-content/uploads/2026/11/FLV-SPASSO-2.png" />
    <img src="https://spassosabores.com.br/wp-content/uploads/2026/11/ACOUGUE-SPASSO-2.png" />
  `;
  const flyer = discoverSpassoFlyersFromHtml(html);
  assert.ok(flyer);
  assert.equal(flyer.imageUrls.length, 2);
});

test("discoverCorsoFlyerFromHtml reads hash when src attribute uses &amp;", () => {
  const html = '<img src="img/jornal-frente.jpg?hash=1794507762&amp;v=2" alt="frente" />';
  const flyer = discoverCorsoFlyerFromHtml(html);
  assert.ok(flyer);
  assert.equal(flyer.hash, "1794507762");
});