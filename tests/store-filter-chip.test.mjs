import assert from "node:assert/strict";
import test from "node:test";

import { describeStoreFilterChip } from "../scripts/domain/store-filter-chip.mjs";

test("store filter chips use short labels and logo metadata", () => {
  assert.deepEqual(describeStoreFilterChip("Todas as lojas", 100).label, "Todas · 100");
  const big = describeStoreFilterChip("Big Bom", 40);
  assert.equal(big.label, "BB · 40");
  assert.equal(big.logoSrc, "logos/bigbom.png");
  assert.equal(big.markClass, "bigbom-mark");
});
