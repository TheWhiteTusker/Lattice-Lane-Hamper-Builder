import { num, round2 } from "./numbers.ts";
import { calculateDimensionArea, type DimensionUnit } from "./dimensions.ts";
import type { ProductCostLine } from "./types";

export * from "./dimensions.ts";

/**
 * Computes the line total cost for a cost item line.
 */
export function calculateLineCost(line: Partial<ProductCostLine>): {
  calculated_area: number;
  line_total: number;
} {
  const stage = (line.stage_code ?? "").toLowerCase();
  const rate = num(line.rate);
  // Blank qty means 1; an explicit 0 means the line costs nothing.
  const qty = line.qty == null ? 1 : num(line.qty);
  // Bought-out items take only the sheet-level markup, never a per-line one.
  const wastage = stage === "bought_out" ? 0 : num(line.wastage_pct);

  // Machine stage is priced per minute
  if (stage === "machine") {
    const duration = num(line.duration_minutes);
    const baseCost = duration * rate * qty;
    const total = baseCost * (1 + wastage / 100);
    return {
      calculated_area: duration,
      line_total: round2(total),
    };
  }

  const dimUnit = (line.dimension_unit as DimensionUnit) || "inch";
  const unit = line.unit || "sq ft";
  const l = num(line.length);
  const b = num(line.breadth);

  const isLinearUnit = [
    "feet",
    "ft",
    "running ft",
    "rft",
    "inch",
    "in",
    "mm",
    "cm",
    "meter",
    "m",
  ].includes(unit.trim().toLowerCase());

  const isAreaUnit = [
    "sq ft",
    "sqft",
    "sft",
    "sq inch",
    "sq in",
    "sqin",
    "sq mm",
    "sqmm",
    "sq cm",
    "sqcm",
  ].includes(unit.trim().toLowerCase());

  let area = 1;
  let baseCost = 0;

  if (isLinearUnit && l > 0) {
    area = calculateDimensionArea(l, b, dimUnit, unit);
    baseCost = area * rate * qty;
  } else if (isAreaUnit && l > 0 && b > 0) {
    area = calculateDimensionArea(l, b, dimUnit, unit);
    baseCost = area * rate * qty;
  } else {
    // Piece-based or no dimension multiplication
    baseCost = rate * qty;
  }

  const total = baseCost * (1 + wastage / 100);

  return {
    calculated_area: area,
    line_total: round2(total),
  };
}

export type CostSheetTotals = {
  material_total: number;
  hardware_total: number;
  finishing_total: number;
  machine_total: number;
  other_total: number;
  total_cost: number;
  markup_pct: number;
  calculated_sp: number;
  target_margin: number;
};

/**
 * Aggregates all lines by stage and calculates selling price and margin.
 */
export function calculateCostSheetTotals(
  lines: Partial<ProductCostLine>[],
  markupPct: unknown = 0,
): CostSheetTotals {
  let material_total = 0;
  let hardware_total = 0;
  let finishing_total = 0;
  let machine_total = 0;
  let other_total = 0;

  for (const line of lines) {
    const { line_total } = calculateLineCost(line);
    const stage = (line.stage_code ?? "").toLowerCase();

    if (stage === "material") {
      material_total += line_total;
    } else if (stage === "hardware") {
      hardware_total += line_total;
    } else if (stage === "finishing") {
      finishing_total += line_total;
    } else if (stage === "machine") {
      machine_total += line_total;
    } else {
      // miscellaneous, bought_out, or any stage added later
      other_total += line_total;
    }
  }

  material_total = round2(material_total);
  hardware_total = round2(hardware_total);
  finishing_total = round2(finishing_total);
  machine_total = round2(machine_total);
  other_total = round2(other_total);

  const total_cost = round2(
    material_total + hardware_total + finishing_total + machine_total + other_total,
  );

  const mPct = num(markupPct);
  // SP = CP / (1 - markup% / 100). A markup of 100% or more has no finite
  // selling price, so it falls back to cost price rather than Infinity/NaN.
  const divisor = 1 - mPct / 100;
  const calculated_sp = divisor > 0 ? round2(total_cost / divisor) : total_cost;
  const target_margin = calculated_sp > 0 ? (calculated_sp - total_cost) / calculated_sp : 0;

  return {
    material_total,
    hardware_total,
    finishing_total,
    machine_total,
    other_total,
    total_cost,
    markup_pct: mPct,
    calculated_sp,
    target_margin: round2(target_margin),
  };
}
