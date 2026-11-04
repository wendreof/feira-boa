import assert from "node:assert/strict";
import test from "node:test";

import { describeStoreFilterChip } from "../scripts/domain/store-filter-chip.mjs";

test("store filter chips show the grocery name under the logo", () => {
  assert.equal(describeStoreFilterChip("Todas as lojas", 100).label, "Todas");
  const big = describeStoreFilterChip("Big Bom", 40);
  assert.equal(big.label, "Big Bom");
  assert.equal(big.fallback, "BB");
  assert.equal(big.logoSrc, "logos/bigbom.png");
  assert.equal(big.markClass, "bigbom-mark");
});
