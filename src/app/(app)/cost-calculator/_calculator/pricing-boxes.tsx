"use client";

import { formatMoney, formatPct, num } from "@/lib/pricing.ts";
import type { Pricing } from "./use-pricing";

const box = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
const caption = "text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider";
const note = "mt-1 text-[11px] text-[var(--color-muted)]";

/** Cost price, markup %, selling price and margin. */
export function PricingBoxes({ pricing }: { pricing: Pricing; source?: string }) {
  const { totals } = pricing;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className={box}>
        <span className={caption}>Total Cost Price (CP)</span>
        <div className="mt-1 font-mono text-2xl font-black text-[var(--color-ink)]">
          {formatMoney(totals.total_cost)}
        </div>
        <p className={note}>
          Sum of Material + HW + Finishing + Machine + Misc + Bought Out
        </p>
      </div>

      <div className={box}>
        <label htmlFor="calc-markup" className={caption}>
          Markup %
        </label>
        <div className="mt-1 flex items-center gap-1">
          <input
            id="calc-markup"
            type="number"
            step="any"
            value={pricing.markupPct}
            onChange={(e) => pricing.changeMarkup(e.target.value)}
            className="input input-num text-lg font-bold font-mono py-1"
          />
          <span className="text-base font-bold text-[var(--color-muted)]">%</span>
        </div>
        <p className={note}>Selling Price = CP &divide; (1 &minus; Markup%)</p>
        {num(pricing.markupPct) >= 100 && (
          <p className="mt-1 text-[11px] font-semibold text-red-600">
            Markup must be under 100% — at 100% the formula has no finite price.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-[var(--color-brand)] bg-emerald-50/40 p-4 shadow-sm">
        <label
          htmlFor="calc-sp"
          className="text-xs font-semibold text-[var(--color-brand-dark)] uppercase tracking-wider"
        >
          Selling Price (SP)
        </label>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-lg font-bold text-[var(--color-brand-dark)]">₹</span>
          <input
            id="calc-sp"
            type="number"
            step="any"
            value={pricing.manualSp}
            onChange={(e) => pricing.changeSp(e.target.value)}
            onBlur={() => pricing.roundManualSp()}
            placeholder={String(totals.calculated_sp)}
            className="input input-num text-lg font-black font-mono py-1 text-[var(--color-brand-dark)]"
          />
        </div>
        <p className={note}>Default catalogue price saved to product</p>
      </div>

      <div className={box}>
        <span className={caption}>Target Margin</span>
        <div className="mt-1 font-mono text-2xl font-black text-emerald-700">
          {formatPct(pricing.effectiveMargin, 1)}
        </div>
        <p className={note}>Margin = (SP &minus; CP) / SP</p>
      </div>
    </div>
  );
}
