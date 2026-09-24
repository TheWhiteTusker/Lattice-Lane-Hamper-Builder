import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateDimensionArea,
  calculateLineCost,
  calculateCostSheetTotals,
  scaledPrice,
  withOverhead,
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

test("calculateDimensionArea handles feet (linear)", () => {
  // 24 inches = 2 feet
  assert.equal(calculateDimensionArea(24, 0, "inch", "feet"), 2);
  // 36 inches = 3 feet
  assert.equal(calculateDimensionArea(36, 12, "inch", "feet"), 3);
  // 304.8 mm = 1 foot
  assert.equal(calculateDimensionArea(304.8, 0, "mm", "feet"), 1);
  // 30.48 cm = 1 foot
  assert.equal(calculateDimensionArea(30.48, 0, "cm", "feet"), 1);
});

test("calculateDimensionArea handles inch, mm, and cm (linear)", () => {
  // 12 inches entered in inches = 12 inch
  assert.equal(calculateDimensionArea(12, 0, "inch", "inch"), 12);
  // 50.8 mm entered in mm = 2 inch
  assert.equal(calculateDimensionArea(50.8, 0, "mm", "inch"), 2);
  // 500 mm entered in mm = 500 mm
  assert.equal(calculateDimensionArea(500, 0, "mm", "mm"), 500);
  // 50 cm entered in cm = 500 mm
  assert.equal(calculateDimensionArea(50, 0, "cm", "mm"), 500);
  // 2 inch entered in inch = 50.8 mm
  assert.equal(calculateDimensionArea(2, 0, "inch", "mm"), 50.8);
  // 25 cm entered in cm = 25 cm
  assert.equal(calculateDimensionArea(25, 0, "cm", "cm"), 25);
  // 100 mm entered in mm = 10 cm
  assert.equal(calculateDimensionArea(100, 0, "mm", "cm"), 10);
  // 2 inches entered in inch = 5.08 cm
  assert.equal(calculateDimensionArea(2, 0, "inch", "cm"), 5.08);
});

test("calculateDimensionArea handles sq inch", () => {
  // 10 in x 5 in = 50 sq inch
  assert.equal(calculateDimensionArea(10, 5, "inch", "sq inch"), 50);
  // 25.4 mm x 25.4 mm = 1 sq inch
  assert.equal(calculateDimensionArea(25.4, 25.4, "mm", "sq inch"), 1);
});

test("calculateDimensionArea handles sq mm", () => {
  // 100 mm x 200 mm = 20000 sq mm
  assert.equal(calculateDimensionArea(100, 200, "mm", "sq mm"), 20000);
  // 10 cm x 20 cm = 20000 sq mm
  assert.equal(calculateDimensionArea(10, 20, "cm", "sq mm"), 20000);
});

test("calculateDimensionArea handles sq cm", () => {
  // 10 cm x 20 cm = 200 sq cm
  assert.equal(calculateDimensionArea(10, 20, "cm", "sq cm"), 200);
  // 100 mm x 200 mm = 200 sq cm
  assert.equal(calculateDimensionArea(100, 200, "mm", "sq cm"), 200);
  // 2 in x 4 in = 5.08 cm x 10.16 cm = 51.61 sq cm
  assert.equal(calculateDimensionArea(2, 4, "inch", "sq cm"), 51.61);
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

test("calculateLineCost for linear feet material", () => {
  // Edge banding: 36 inches (3 feet) at ₹20/feet, qty 2, 0% wastage
  // Base cost = 3 ft * 20 * 2 = 120
  const line = calculateLineCost({
    stage_code: "material",
    length: 36,
    dimension_unit: "inch",
    unit: "feet",
    rate: 20,
    qty: 2,
    wastage_pct: 0,
  });

  assert.equal(line.calculated_area, 3);
  assert.equal(line.line_total, 120);
});

test("calculateLineCost for sq cm finishing", () => {
  // UV print: 10cm x 20cm (200 sq cm) at ₹0.5/sq cm, qty 1, 0% wastage
  // Base cost = 200 * 0.5 * 1 = 100
  const line = calculateLineCost({
    stage_code: "finishing",
    length: 10,
    breadth: 20,
    dimension_unit: "cm",
    unit: "sq cm",
    rate: 0.5,
    qty: 1,
    wastage_pct: 0,
  });

  assert.equal(line.calculated_area, 200);
  assert.equal(line.line_total, 100);
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
  // Markup 50% -> SP = 451 / (1 - 0.5) = 902 -> rounded up to next 10 is 910
  const totals = calculateCostSheetTotals(lines, 50);

  assert.equal(totals.material_total, 187);
  assert.equal(totals.hardware_total, 40);
  assert.equal(totals.finishing_total, 35);
  assert.equal(totals.machine_total, 189);
  assert.equal(totals.total_cost, 451);
  assert.equal(totals.markup_pct, 50);
  assert.equal(totals.calculated_sp, 910);
  assert.equal(totals.target_margin, 0.5); // 50% margin
});

test("miscellaneous and bought-out lines roll into total cost", () => {
  const lines = [
    // Material: 100 x 1, no wastage
    { stage_code: "material", unit: "piece", rate: 100, qty: 1, wastage_pct: 0 },
    // Miscellaneous: free-text line, 50 x 2 = 100
    { stage_code: "miscellaneous", unit: "piece", rate: 50, qty: 2, wastage_pct: 0 },
    // Bought out: 200 x 1; a stale per-line markup (old sheets) is ignored
    { stage_code: "bought_out", unit: "piece", rate: 200, qty: 1, wastage_pct: 25 },
    // Untouched placeholder line: qty 0 costs nothing
    { stage_code: "hardware", unit: "piece", rate: 300, qty: 0, wastage_pct: 0 },
  ];

  const totals = calculateCostSheetTotals(lines, 50);

  assert.equal(totals.material_total, 100);
  assert.equal(totals.hardware_total, 0);
  assert.equal(totals.other_total, 300); // 100 misc + 200 bought out
  assert.equal(totals.total_cost, 400);
  assert.equal(totals.calculated_sp, 800); // 400 / (1 - 0.5)
});

test("SP = CP / (1 - markup%), and 100%+ markup falls back to cost price", () => {
  const lines = [
    { stage_code: "material", unit: "piece", rate: 600, qty: 1, wastage_pct: 0 },
  ];

  // 40% markup on 600 -> 600 / 0.6 = 1000, margin 40%
  const forty = calculateCostSheetTotals(lines, 40);
  assert.equal(forty.total_cost, 600);
  assert.equal(forty.calculated_sp, 1000);
  assert.equal(forty.target_margin, 0.4);

  // 0% markup sells at cost
  assert.equal(calculateCostSheetTotals(lines, 0).calculated_sp, 600);

  // No finite price at or above 100% - must not be Infinity or NaN
  for (const bad of [100, 150]) {
    const sp = calculateCostSheetTotals(lines, bad).calculated_sp;
    assert.ok(Number.isFinite(sp), `markup ${bad}% produced ${sp}`);
    assert.equal(sp, 600);
  }
});

test("a stage's overhead % is added to that stage's subtotal only", () => {
  const lines = [
    { stage_code: "material", unit: "piece", rate: 100, qty: 2, wastage_pct: 0 }, // 200
    { stage_code: "hardware", unit: "piece", rate: 50, qty: 1, wastage_pct: 0 }, // 50
    { stage_code: "miscellaneous", unit: "piece", rate: 40, qty: 1, wastage_pct: 0 }, // 40
  ];

  const totals = calculateCostSheetTotals(lines, 50, { material: 10, miscellaneous: "25" });

  assert.equal(totals.material_total, 220); // 200 + 10%
  assert.equal(totals.hardware_total, 50); // no overhead set
  assert.equal(totals.other_total, 50); // 40 + 25%
  assert.equal(totals.total_cost, 320);
  assert.equal(totals.calculated_sp, 640); // overhead flows into the selling price

  // Blank or missing overhead changes nothing
  assert.equal(calculateCostSheetTotals(lines, 50, { material: "" }).total_cost, 290);
  assert.equal(withOverhead(200, 10), 220);
  assert.equal(withOverhead(99.99, ""), 99.99);
});

test("machine rates follow their unit: per minute, per hour, or by size", () => {
  const base = { stage_code: "machine", duration_minutes: 30, qty: 1, wastage_pct: 0 };
  // Per minute (and a line with no unit, as older sheets have): 30 min x 3 = 90
  assert.equal(calculateLineCost({ ...base, unit: "min", rate: 3 }).line_total, 90);
  assert.equal(calculateLineCost({ ...base, rate: 3 }).line_total, 90);
  // Per hour: 30 min = 0.5 h x 600 = 300
  assert.equal(calculateLineCost({ ...base, unit: "hour", rate: 600 }).line_total, 300);
  // Engraving per sq inch: 4" x 5" = 20 sq inch x 0.25 = 5; the duration is ignored
  const engraving = calculateLineCost({ ...base, unit: "sq inch", rate: 0.25, length: 4, breadth: 5, dimension_unit: "inch" });
  assert.equal(engraving.calculated_area, 20);
  assert.equal(engraving.line_total, 5);
});

test("the exact area is costed; the stored area is rounded for display", () => {
  // 5" x 5" = 0.1736 sq ft: 0.1736 x 1000 = 173.61, not 0.17 x 1000 = 170
  const line = calculateLineCost({ stage_code: "material", unit: "sq ft", rate: 1000, length: 5, breadth: 5, dimension_unit: "inch", qty: 1, wastage_pct: 0 });
  assert.equal(line.calculated_area, 0.17);
  assert.equal(line.line_total, 173.61);
});

test("a repriced product keeps its margin, including a hand-set price", () => {
  // Priced by the markup formula: 55.5 cost -> 277.5 (80% margin); cost +10% -> price +10%
  // 305.25 rounds up to next 10 -> 310
  assert.equal(scaledPrice(55.5, 277.5, 61.05, 999), 310);
  // Hand-set price above the markup price stays proportionally above it
  // 3171.65 rounds up to next 10 -> 3180
  assert.equal(scaledPrice(321.78, 2883.3, 353.96, 999), 3180);
  // Nothing to scale from: use the markup price given
  assert.equal(scaledPrice(0, 0, 100, 500), 500);
});
