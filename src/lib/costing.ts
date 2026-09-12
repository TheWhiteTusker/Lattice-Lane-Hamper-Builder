import { num, round2 } from "./pricing.ts";
import type { ProductCostLine } from "./types";

export type DimensionUnit = "inch" | "mm" | "cm";

export const COMMON_UNITS = [
  "sq ft",
  "sq inch",
  "sq mm",
  "piece",
  "running ft",
  "min",
  "hour",
  "set",
  "meter",
  "kg",
] as const;

export type UnitType = (typeof COMMON_UNITS)[number];

/**
 * Calculates the unit area/quantity based on entered dimensions and the pricing unit.
 */
export function calculateDimensionArea(
  lengthVal: unknown,
  breadthVal: unknown,
  dimensionUnit: DimensionUnit = "inch",
  targetUnit: string = "sq ft",
): number {
  const l = num(lengthVal);
  const b = num(breadthVal);

  if (l <= 0 || b <= 0) return 1;

  const unitLower = (targetUnit || "").trim().toLowerCase();

  // Convert dimensions to inches first as a common baseline
  let lInches = l;
  let bInches = b;

  if (dimensionUnit === "mm") {
    lInches = l / 25.4;
    bInches = b / 25.4;
  } else if (dimensionUnit === "cm") {
    lInches = l / 2.54;
    bInches = b / 2.54;
  }

  if (unitLower === "sq ft" || unitLower === "sqft" || unitLower === "sft") {
    return round2((lInches * bInches) / 144);
  }

  if (unitLower === "sq inch" || unitLower === "sq in" || unitLower === "sqin") {
    return round2(lInches * bInches);
  }

  if (unitLower === "sq mm" || unitLower === "sqmm") {
    const lMm = dimensionUnit === "mm" ? l : lInches * 25.4;
    const bMm = dimensionUnit === "mm" ? b : bInches * 25.4;
    return round2(lMm * bMm);
  }

  if (unitLower === "running ft" || unitLower === "rft") {
    return round2(lInches / 12);
  }

  // For piece / each / nos or other units, dimensions are descriptive rather than multiplying
  return 1;
}

/**
 * Computes the line total cost for a cost item line.
 */
export function calculateLineCost(line: Partial<ProductCostLine>): {
  calculated_area: number;
  line_total: number;
} {
  const stage = (line.stage_code ?? "").toLowerCase();
  const rate = num(line.rate);
  const qty = num(line.qty) || 1;
  const wastage = num(line.wastage_pct);

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

  const isAreaUnit = [
    "sq ft",
    "sqft",
    "sft",
    "sq inch",
    "sq in",
    "sq mm",
    "running ft",
    "rft",
  ].includes(unit.trim().toLowerCase());

  let area = 1;
  let baseCost = 0;

  if (isAreaUnit && l > 0 && b > 0) {
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
    }
  }

  material_total = round2(material_total);
  hardware_total = round2(hardware_total);
  finishing_total = round2(finishing_total);
  machine_total = round2(machine_total);

  const total_cost = round2(
    material_total + hardware_total + finishing_total + machine_total,
  );

  const mPct = num(markupPct);
  const calculated_sp = round2(total_cost * (1 + mPct / 100));
  const target_margin = calculated_sp > 0 ? (calculated_sp - total_cost) / calculated_sp : 0;

  return {
    material_total,
    hardware_total,
    finishing_total,
    machine_total,
    total_cost,
    markup_pct: mPct,
    calculated_sp,
    target_margin: round2(target_margin),
  };
}
