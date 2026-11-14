import test from "node:test";
import assert from "node:assert/strict";

import {
  OFFER_GRID_IDLE_CHUNK,
  OFFER_GRID_INITIAL_CHUNK,
  offerGridMountPlan,
} from "../scripts/domain/offer-grid-chunks.mjs";

test("offerGridMountPlan returns one batch for small feeds", () => {
  assert.deepEqual(offerGridMountPlan(0), []);
  assert.deepEqual(offerGridMountPlan(12), [12]);
  assert.deepEqual(offerGridMountPlan(OFFER_GRID_INITIAL_CHUNK), [OFFER_GRID_INITIAL_CHUNK]);
});

test("offerGridMountPlan chunks large feeds after the initial sync batch", () => {
  const total = OFFER_GRID_INITIAL_CHUNK + OFFER_GRID_IDLE_CHUNK + 17;
  const plan = offerGridMountPlan(total);
  assert.deepEqual(plan, [OFFER_GRID_INITIAL_CHUNK, OFFER_GRID_IDLE_CHUNK, 17]);
  assert.equal(plan.reduce((sum, size) => sum + size, 0), total);
});