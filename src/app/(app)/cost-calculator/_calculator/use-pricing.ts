import { useMemo, useState } from "react";
import { calculateCostSheetTotals } from "@/lib/costing.ts";
import { num, round2, roundUpToNext10 } from "@/lib/pricing.ts";
import type { Product, ProductCostSheet } from "@/lib/types";
import type { LineState } from "./lines";

export type Pricing = ReturnType<typeof usePricing>;

/**
 * Live totals, with markup % and selling price each updating the other.
 * Each stage's overhead % is added to that stage's subtotal.
 */
export function usePricing(
  activeLines: LineState[],
  initialProduct?: Product | null,
  initialSheet?: ProductCostSheet | null,
) {
  const [markupPct, setMarkupPct] = useState(
    String(initialProduct?.markup_pct ?? initialSheet?.markup_pct ?? "50"),
  );
  const [manualSp, setManualSp] = useState(
    String(initialProduct?.default_sp ?? initialSheet?.calculated_sp ?? ""),
  );

  // Stage code -> overhead % as typed.
  const [overheads, setOverheads] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initialSheet?.stage_overheads ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const overheadFor = (stageCode: string) => overheads[stageCode.toLowerCase()] ?? "";
  const setOverhead = (stageCode: string, pct: string) =>
    setOverheads((prev) => ({ ...prev, [stageCode.toLowerCase()]: pct }));

  const totals = useMemo(
    () => calculateCostSheetTotals(activeLines, num(markupPct), overheads),
    [activeLines, markupPct, overheads],
  );
  const effectiveSp = manualSp ? roundUpToNext10(num(manualSp)) : totals.calculated_sp;
  const effectiveMargin = effectiveSp > 0 ? (effectiveSp - totals.total_cost) / effectiveSp : 0;

  function changeMarkup(val: string) {
    setMarkupPct(val);
    const divisor = 1 - num(val) / 100;
    // 100%+ has no finite SP; leave the price alone rather than show Infinity
    if (divisor <= 0) return;
    setManualSp(String(roundUpToNext10(totals.total_cost / divisor)));
  }

  function changeSp(val: string) {
    setManualSp(val);
    const sp = num(val);
    if (totals.total_cost > 0 && sp > 0) {
      setMarkupPct(String(round2(((sp - totals.total_cost) / sp) * 100)));
    }
  }

  function roundManualSp() {
    if (manualSp) {
      const rounded = roundUpToNext10(num(manualSp));
      if (rounded > 0 && String(rounded) !== manualSp) {
        setManualSp(String(rounded));
        if (totals.total_cost > 0) {
          setMarkupPct(String(round2(((rounded - totals.total_cost) / rounded) * 100)));
        }
      }
    }
  }

  /** The overheads to save: numbers, blanks and zeros left out. */
  const stageOverheads = Object.fromEntries(
    Object.entries(overheads).flatMap(([k, v]) => (num(v) ? [[k, num(v)]] : [])),
  );

  return {
    markupPct, manualSp, totals, effectiveSp, effectiveMargin, changeMarkup, changeSp, roundManualSp,
    overheadFor, setOverhead, stageOverheads,
  };
}
