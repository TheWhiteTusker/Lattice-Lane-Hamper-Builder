import { test } from "node:test";
import assert from "node:assert/strict";
import { amountInWords } from "./pricing.ts";
import { codesForColors } from "./product-code.ts";

test("amountInWords follows the invoice wording", () => {
  assert.equal(amountInWords(70800), "Seventy Thousand And Eight Hundred Rupees Only");
  assert.equal(amountInWords(105), "One Hundred And Five Rupees Only");
  assert.equal(amountInWords(0), "Zero Rupees Only");
  assert.equal(
    amountInWords(123456789.5),
    "Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred And Eighty Nine Rupees And Fifty Paise Only",
  );
});

test("codesForColors gives one code per colour, same category and serial", () => {
  assert.deepEqual(codesForColors("LC/0007/WL", ["Walnut", "Natural", "Black"]), [
    { color: "Walnut", code: "LC/0007/WL" },
    { color: "Natural", code: "LC/0007/NT" },
    { color: "Black", code: "LC/0007/BL" },
  ]);
  assert.deepEqual(codesForColors("", ["Black"]), [{ color: "Black", code: "/BL" }]);
});
