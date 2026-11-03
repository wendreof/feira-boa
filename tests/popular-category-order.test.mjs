import assert from "node:assert/strict";
import test from "node:test";
import {
  PINNED_POPULAR_DEPARTMENT_IDS,
  RANDOM_POPULAR_DEPARTMENT_IDS,
} from "../scripts/domain/popular-category-order.mjs";
import { FRIOS_EMBUTIDOS_DEPARTMENT_ID } from "../scripts/domain/frios-department.mjs";

test("pinned popular categories stay fixed", () => {
  assert.deepEqual(PINNED_POPULAR_DEPARTMENT_IDS, [
    "carnes",
    "bebidas_alcoolicas",
    FRIOS_EMBUTIDOS_DEPARTMENT_ID,
  ]);
});

test("random popular pool excludes pinned ids", () => {
  for (const id of PINNED_POPULAR_DEPARTMENT_IDS) {
    assert.equal(RANDOM_POPULAR_DEPARTMENT_IDS.includes(id), false);
  }
  assert.equal(RANDOM_POPULAR_DEPARTMENT_IDS.includes("outros"), false);
  assert.equal(RANDOM_POPULAR_DEPARTMENT_IDS.includes("bebidas"), true);
});
