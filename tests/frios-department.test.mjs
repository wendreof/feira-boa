import assert from "node:assert/strict";
import test from "node:test";
import { matchesFriosEmbutidosDepartment } from "../scripts/domain/frios-department.mjs";

test("matchesFriosEmbutidosDepartment uses catalog subcategory", () => {
  assert.equal(matchesFriosEmbutidosDepartment({ subcategory: "Frios e embutidos" }), true);
  assert.equal(matchesFriosEmbutidosDepartment({ subcategory: "Açougue e carnes frescas" }), false);
  assert.equal(matchesFriosEmbutidosDepartment({ subcategory: "Laticínios e ovos" }), false);
  assert.equal(matchesFriosEmbutidosDepartment({ subcategory: "Peixaria e frutos do mar" }), false);
});
