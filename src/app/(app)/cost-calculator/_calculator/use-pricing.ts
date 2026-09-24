import { useMemo, useState } from "react";
import { calculateCostSheetTotals } from "@/lib/costing.ts";
import { num, round2 } from "@/lib/pricing.ts";
import type { Product, ProductCostSheet } from "@/lib/types";
import type { LineState } from "./lines";

export type Pricing = ReturnType<typeof usePricing>;

/** Live totals, with markup % and selling price each updating the other. */
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

  const totals = useMemo(
    () => calculateCostSheetTotals(activeLines, num(markupPct)),
    [activeLines, markupPct],
  );
  const effectiveSp = manualSp ? num(manualSp) : totals.calculated_sp;
  const effectiveMargin = effectiveSp > 0 ? (effectiveSp - totals.total_cost) / effectiveSp : 0;

  function changeMarkup(val: string) {
    setMarkupPct(val);
    const divisor = 1 - num(val) / 100;
    // 100%+ has no finite SP; leave the price alone rather than show Infinity
    if (divisor <= 0) return;
    setManualSp(String(round2(totals.total_cost / divisor)));
  }

  function changeSp(val: string) {
    setManualSp(val);
    const sp = num(val);
    if (totals.total_cost > 0 && sp > 0) {
      setMarkupPct(String(round2(((sp - totals.total_cost) / sp) * 100)));
    }
  }

  return { markupPct, manualSp, totals, effectiveSp, effectiveMargin, changeMarkup, changeSp };
}
