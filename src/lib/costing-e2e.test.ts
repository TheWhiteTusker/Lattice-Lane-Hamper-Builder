import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateLineCost,
  calculateCostSheetTotals,
} from "./costing.ts";
import type { ProductCostLine } from "./types.ts";

test("full workflow: user adds birch material, cylinder magnet hardware, PU polish, and laser cutting", () => {
  const lines: ProductCostLine[] = [
    // 1. Material: 8mm Birch, 10" x 8" (0.56 sq ft), Rate ₹85/sq ft, Qty 2, 10% wastage
    {
      stage_code: "material",
      category_name: "Woodbased",
      item_name: "8mm Birch",
      length: 10,
      breadth: 8,
      dimension_unit: "inch",
      unit: "sq ft",
      rate: 85,
      qty: 2,
      wastage_pct: 10,
      line_total: 0,
    },
    // 2. Cloned/Duplicated line for 4mm Birch lid: 10" x 8", Rate ₹55/sq ft, Qty 1, 10% wastage
    {
      stage_code: "material",
      category_name: "Woodbased",
      item_name: "4mm Birch",
      length: 10,
      breadth: 8,
      dimension_unit: "inch",
      unit: "sq ft",
      rate: 55,
      qty: 1,
      wastage_pct: 10,
      line_total: 0,
    },
    // 3. Hardware: 2 Cylinder Magnets @ ₹10 each, 0% wastage
    {
      stage_code: "hardware",
      category_name: "Magnets",
      item_name: "Cylinder Magnet",
      unit: "piece",
      rate: 10,
      qty: 2,
      wastage_pct: 0,
      line_total: 0,
    },
    // 4. Finishing: PU Polish on outer surface (1.5 sq ft), Rate ₹35/sq ft, Qty 1, 5% wastage
    {
      stage_code: "finishing",
      category_name: "Polish",
      item_name: "PU Polish Matt/Gloss",
      length: 18,
      breadth: 12,
      dimension_unit: "inch",
      unit: "sq ft",
      rate: 35,
      qty: 1,
      wastage_pct: 5,
      line_total: 0,
    },
    // 5. Machine Cost: Laser cutting Birch 12 mins @ ₹12/min, 5% buffer
    {
      stage_code: "machine",
      category_name: "Laser",
      item_name: "Laser Cutting (Birch/Wood)",
      duration_minutes: 12,
      unit: "min",
      rate: 12,
      qty: 1,
      wastage_pct: 5,
      line_total: 0,
    },
  ];

  // Verify line calculations
  const line1 = calculateLineCost(lines[0]);
  // 10 * 8 / 144 = 0.56 sq ft * 85 * 2 = 95.2 * 1.10 = 104.72
  assert.equal(line1.calculated_area, 0.56);
  assert.equal(line1.line_total, 104.72);

  const line2 = calculateLineCost(lines[1]);
  // 10 * 8 / 144 = 0.56 sq ft * 55 * 1 = 30.8 * 1.10 = 33.88
  assert.equal(line2.calculated_area, 0.56);
  assert.equal(line2.line_total, 33.88);

  const line3 = calculateLineCost(lines[2]);
  // 2 * 10 = 20
  assert.equal(line3.line_total, 20);

  const line4 = calculateLineCost(lines[3]);
  // 18 * 12 / 144 = 1.5 sq ft * 35 * 1 = 52.5 * 1.05 = 55.13
  assert.equal(line4.calculated_area, 1.5);
  assert.equal(line4.line_total, 55.13);

  const line5 = calculateLineCost(lines[4]);
  // 12 mins * 12 * 1 = 144 * 1.05 = 151.2
  assert.equal(line5.calculated_area, 12);
  assert.equal(line5.line_total, 151.2);

  // Grand totals with 120% markup
  const totals = calculateCostSheetTotals(lines, 120);

  // Material: 104.72 + 33.88 = 138.6
  assert.equal(totals.material_total, 138.6);
  // Hardware: 20
  assert.equal(totals.hardware_total, 20);
  // Finishing: 55.13
  assert.equal(totals.finishing_total, 55.13);
  // Machine: 151.2
  assert.equal(totals.machine_total, 151.2);

  // Total Cost Price: 138.6 + 20 + 55.13 + 151.2 = 364.93
  assert.equal(totals.total_cost, 364.93);

  // Selling Price with 120% markup: 364.93 * 2.2 = 802.85
  assert.equal(totals.calculated_sp, 802.85);

  // Target Margin: (802.85 - 364.93) / 802.85 = 54.5%
  assert.equal(totals.target_margin, 0.55);
});
