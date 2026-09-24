"use client";

import { formatMoney, formatPct, round2, type HamperPricing } from "@/lib/pricing";
import { Cell, NumField } from "./controls";
import type { HamperFields } from "./hamper-state";

const tone = (v: number | null) => (v === null ? undefined : v < 0 ? "bad" : "good");

/**
 * One strip between the hamper details and the products, so the numbers
 * that move while you edit lines stay on screen.
 */
export function HamperPricingStrip({
  f,
  set,
  totals,
  canEdit,
}: {
  f: HamperFields;
  set: (key: keyof HamperFields, value: string) => void;
  totals: HamperPricing;
  canEdit: boolean;
}) {
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Cell label="Total cost" value={formatMoney(totals.totalCp)} />
        <Cell label="Base SP" value={formatMoney(totals.baseSp)} />

        <NumField id="discount" label="Discount %" value={f.discountPct} onChange={(v) => set("discountPct", v)} disabled={!canEdit} />
        <NumField id="targetSp" label="Target SP" value={f.targetSp} onChange={(v) => set("targetSp", v)} disabled={!canEdit} />

        <Cell label="SP after discount" value={formatMoney(totals.spAfterDiscount)} />
        <Cell
          label="Variance"
          value={totals.variance === null ? "—" : formatMoney(totals.variance)}
          tone={tone(totals.variance)}
        />

        <NumField
          id="finalSp"
          label="Final catalogue SP"
          value={f.finalSp}
          onChange={(v) => set("finalSp", v)}
          disabled={!canEdit}
          hint="Never overwritten by a price refresh"
        />

        <Cell label="Items" value={String(round2(totals.numberOfItems))} />
        <Cell
          label="Gross profit"
          value={totals.grossProfit === null ? "—" : formatMoney(totals.grossProfit)}
          tone={tone(totals.grossProfit)}
        />
        <Cell
          label="Final margin"
          value={totals.finalMargin === null ? "—" : formatPct(totals.finalMargin)}
          tone={tone(totals.finalMargin)}
          strong
        />
      </div>
    </section>
  );
}
