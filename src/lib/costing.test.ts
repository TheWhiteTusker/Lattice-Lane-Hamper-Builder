import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateDimensionArea,
  calculateLineCost,
  calculateCostSheetTotals,
} from "./costing.ts";

test("calculateDimensionArea handles inches to sq ft", () => {
  // 12 in x 12 in = 1 sq ft
  assert.equal(calculateDimensionArea(12, 12, "inch", "sq ft"), 1);
  // 24 in x 12 in = 2 sq ft
  assert.equal(calculateDimensionArea(24, 12, "inch", "sq ft"), 2);
  // 6 in x 6 in = 0.25 sq ft
  assert.equal(calculateDimensionArea(6, 6, "inch", "sq ft"), 0.25);
});

test("calculateDimensionArea handles mm to sq ft", () => {
  // 304.8 mm x 304.8 mm is approx 1 sq ft
  const area = calculateDimensionArea(304.8, 304.8, "mm", "sq ft");
  assert.equal(Math.round(area), 1);
});

test("calculateLineCost for dimensional material", () => {
  // Birch 8mm: 12" x 12" (1 sq ft) at ₹85/sq ft, qty 2, wastage 10%
  // Base cost = 1 sq ft * 85 * 2 = 170
  // With 10% wastage = 170 * 1.10 = 187
  const line = calculateLineCost({
    stage_code: "material",
    length: 12,
    breadth: 12,
    dimension_unit: "inch",
    unit: "sq ft",
    rate: 85,
    qty: 2,
    wastage_pct: 10,
  });

  assert.equal(line.calculated_area, 1);
  assert.equal(line.line_total, 187);
});

test("calculateLineCost for machine per minute cost", () => {
  // Machine: Laser cutting at ₹12/min, 15 minutes, qty 1, 5% wastage/buffer
  // Base cost = 15 * 12 * 1 = 180
  // With 5% wastage = 180 * 1.05 = 189
  const line = calculateLineCost({
    stage_code: "machine",
    duration_minutes: 15,
    rate: 12,
    qty: 1,
    wastage_pct: 5,
  });

  assert.equal(line.calculated_area, 15);
  assert.equal(line.line_total, 189);
});

test("calculateCostSheetTotals aggregates all stages and applies markup", () => {
  const lines = [
    // Material: 187
    {
      stage_code: "material",
      length: 12,
      breadth: 12,
      dimension_unit: "inch",
      unit: "sq ft",
      rate: 85,
      qty: 2,
      wastage_pct: 10,
    },
    // Hardware: 4 Magnets @ ₹10 each, 0% wastage = 40
    {
      stage_code: "hardware",
      unit: "piece",
      rate: 10,
      qty: 4,
      wastage_pct: 0,
    },
    // Finishing: 1 sq ft Polish @ ₹35/sq ft, 0% wastage = 35
    {
      stage_code: "finishing",
      length: 12,
      breadth: 12,
      dimension_unit: "inch",
      unit: "sq ft",
      rate: 35,
      qty: 1,
      wastage_pct: 0,
    },
    // Machine: 15 mins @ ₹12/min, 5% buffer = 189
    {
      stage_code: "machine",
      duration_minutes: 15,
      rate: 12,
      qty: 1,
      wastage_pct: 5,
    },
  ];

  // Totals:
  // Material: 187
  // Hardware: 40
  // Finishing: 35
  // Machine: 189
  // Total Cost = 451
  // Markup 100% -> SP = 451 * 2 = 902
  const totals = calculateCostSheetTotals(lines, 100);

  assert.equal(totals.material_total, 187);
  assert.equal(totals.hardware_total, 40);
  assert.equal(totals.finishing_total, 35);
  assert.equal(totals.machine_total, 189);
  assert.equal(totals.total_cost, 451);
  assert.equal(totals.markup_pct, 100);
  assert.equal(totals.calculated_sp, 902);
  assert.equal(totals.target_margin, 0.5); // 50% margin
});
