import assert from "node:assert/strict";
import test from "node:test";
import { isBarbecueProductName, isPoultryCounterOffer } from "../scripts/domain/churrasco-classification.mjs";

test("poultry kg cuts stay out of churrasco classification", () => {
  assert.ok(isPoultryCounterOffer("Coxa c/ Sobrecoxa de Frango"));
  assert.equal(isBarbecueProductName("Coxa c/ Sobrecoxa de Frango"), false);
  assert.ok(isBarbecueProductName("Picanha Friboi"));
  assert.equal(isBarbecueProductName("Macarrão Cup Noodles Costela"), false);
});
