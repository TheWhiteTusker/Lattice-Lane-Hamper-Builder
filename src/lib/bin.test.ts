import test from "node:test";
import assert from "node:assert/strict";
import { calculateExpiry, RETENTION_DAYS } from "./bin.ts";

test("calculateExpiry returns 30 days retention window for recently deleted item", () => {
  const now = new Date("2026-09-24T12:00:00Z");
  const exp = calculateExpiry(now.toISOString(), now.getTime());

  assert.equal(exp.daysRemaining, RETENTION_DAYS);
  assert.equal(exp.isExpired, false);

  const expiresTime = new Date(exp.expiresAt).getTime();
  const deletedTime = now.getTime();
  const diffDays = Math.round((expiresTime - deletedTime) / (1000 * 60 * 60 * 24));
  assert.equal(diffDays, 30);
});

test("calculateExpiry returns correct days remaining for 10-day old deleted item", () => {
  const baseTime = new Date("2026-09-24T12:00:00Z").getTime();
  const tenDaysAgo = new Date(baseTime - 10 * 24 * 60 * 60 * 1000);
  const exp = calculateExpiry(tenDaysAgo.toISOString(), baseTime);

  assert.equal(exp.daysRemaining, 20);
  assert.equal(exp.isExpired, false);
});

test("calculateExpiry marks items older than 30 days as expired with 0 days remaining", () => {
  const baseTime = new Date("2026-09-24T12:00:00Z").getTime();
  const thirtyOneDaysAgo = new Date(baseTime - 31 * 24 * 60 * 60 * 1000);
  const exp = calculateExpiry(thirtyOneDaysAgo.toISOString(), baseTime);

  assert.equal(exp.daysRemaining, 0);
  assert.equal(exp.isExpired, true);
});
