import { test } from "node:test";
import assert from "node:assert/strict";
import { variantIdsByColor } from "./product-variants.ts";

test("maps each colour finish to its sibling product id", () => {
  assert.deepEqual(
    variantIdsByColor([
      { id: "walnut-id", code: "LC/0001/WL", colors: ["Walnut"] },
      { id: "natural-id", code: "LC/0001/NT", colors: ["Natural"] },
      { id: "black-id", code: "LC/0001/BL", colors: ["Black"] },
    ]),
    { Walnut: "walnut-id", Natural: "natural-id", Black: "black-id" },
  );
});

test("uses the code for legacy variants without a colors array", () => {
  assert.deepEqual(
    variantIdsByColor([
      { id: "walnut-id", code: "LC/0001/WL" },
      { id: "natural-id", code: "LC/0001/NT", colors: [] },
    ]),
    { Walnut: "walnut-id", Natural: "natural-id" },
  );
});
