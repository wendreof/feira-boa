import assert from "node:assert/strict";
import test from "node:test";
import { resolveOfferCardLogo } from "../src/view/store-logo.ts";

test("resolveOfferCardLogo prefers self-hosted logos and store initials", () => {
  const main = resolveOfferCardLogo({
    store: "Big Bom",
    storeLogo: "logos/bigbom.png",
  });
  assert.equal(main.src, "logos/bigbom.png");
  assert.equal(main.fallback, "BB");
  assert.equal(main.markClass, "bigbom-mark");

  const unknown = resolveOfferCardLogo({
    store: "Forte Mix",
    storeLogo: "logos/fortemix.png",
  });
  assert.equal(unknown.src, "logos/fortemix.png");
  assert.equal(unknown.fallback, "FM");
  assert.equal(unknown.markClass, "fortemix-mark");
});
