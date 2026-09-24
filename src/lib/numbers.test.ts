import assert from "node:assert/strict";
import test from "node:test";
import { normalizePct, num, round2, roundUpToNext10 } from "./numbers.ts";

test("roundUpToNext10 rounds up to the next multiple of 10", () => {
  // Specific user requirement example: 271.50 -> 280
  assert.equal(roundUpToNext10(271.5), 280);
  assert.equal(roundUpToNext10("271.50"), 280);

  // Exact multiples of 10 stay unchanged
  assert.equal(roundUpToNext10(270), 270);
  assert.equal(roundUpToNext10(270.0), 270);
  assert.equal(roundUpToNext10(280), 280);
  assert.equal(roundUpToNext10(10), 10);
  assert.equal(roundUpToNext10(100), 100);

  // Just above a multiple of 10 rounds up to next multiple of 10
  assert.equal(roundUpToNext10(270.01), 280);
  assert.equal(roundUpToNext10(270.0001), 280);
  assert.equal(roundUpToNext10(0.01), 10);
  assert.equal(roundUpToNext10(1), 10);
  assert.equal(roundUpToNext10(9.99), 10);

  // Zero, empty, or negative values
  assert.equal(roundUpToNext10(0), 0);
  assert.equal(roundUpToNext10(-5), 0);
  assert.equal(roundUpToNext10(""), 0);
  assert.equal(roundUpToNext10(null), 0);
  assert.equal(roundUpToNext10(undefined), 0);

  // Formatted string values with currency / spaces
  assert.equal(roundUpToNext10("₹ 271.50"), 280);
  assert.equal(roundUpToNext10("1,271.50"), 1280);
});

test("round2 rounds properly to 2 decimals", () => {
  assert.equal(round2(10.123), 10.12);
  assert.equal(round2(10.126), 10.13);
  assert.equal(round2(10), 10);
});

test("num parses numbers and strips currency/symbols", () => {
  assert.equal(num(100), 100);
  assert.equal(num("₹ 1,250.50"), 1250.5);
  assert.equal(num(""), 0);
  assert.equal(num(null), 0);
});

test("normalizePct normalizes percentages", () => {
  assert.equal(normalizePct(0.35), 0.35);
  assert.equal(normalizePct(35), 0.35);
  assert.equal(normalizePct("50%"), 0.5);
});
