"use client";

import { formatMoney } from "@/lib/pricing.ts";
import { NumCell, RemoveButton, SectionHeader, UnitCell } from "./cells";
import { BOUGHT_OUT } from "./lines";
import type { CostLines } from "./use-cost-lines";

/** Finished items purchased in (Outsource / Hybrid): Cost Price = Rate × Qty. */
export function BoughtOutSection({ api }: { api: CostLines }) {
  const lines = api.lines.filter((l) => l.stage_code === BOUGHT_OUT);

  return (
    <div className="card overflow-hidden shadow-sm">
      <SectionHeader
        badge={
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
            B
          </span>
        }
        title="Bought Out Items"
        hint="(Finished items purchased in — Cost Price = Rate × Qty)"
        totalLabel="Bought Out Total:"
        total={formatMoney(lines.reduce((acc, l) => acc + l.line_total, 0))}
      />

      <div className="overflow-x-auto p-2">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] font-semibold text-[var(--color-muted)]">
              <th className="p-2 min-w-[240px]">Material Name</th>
              <th className="p-2 min-w-[95px]">Rate</th>
              <th className="p-2 min-w-[110px]">Unit</th>
              <th className="p-2 min-w-[70px]">Qty</th>
              <th className="p-2 min-w-[110px] text-right">Cost Price</th>
              <th className="p-2 min-w-[70px] text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-[var(--color-muted)]">
                  No bought-out items. Click &ldquo;+ Add Bought Out Item&rdquo; below to start.
                </td>
              </tr>
            ) : (
              lines.map((line) => {
                const set = (patch: Parameters<CostLines["update"]>[1]) => api.update(line.tempKey, patch);
                return (
                  <tr key={line.tempKey} className="transition-colors hover:bg-slate-50/75">
                    <td className="p-2">
                      <input
                        value={line.item_name}
                        onChange={(e) => set({ item_name: e.target.value })}
                        placeholder="e.g. Ceramic diffuser bottle"
                        className="input text-xs py-1 px-2"
                      />
                    </td>
                    <NumCell value={line.rate} mono onChange={(rate) => set({ rate: rate ?? 0 })} />
                    <UnitCell value={line.unit} onChange={(unit) => set({ unit })} />
                    <NumCell value={line.qty} min="0" onChange={(qty) => set({ qty: qty ?? 0 })} />
                    <td className="p-2 text-right font-mono font-semibold text-[var(--color-ink)]">
                      {formatMoney(line.line_total)}
                    </td>
                    <td className="p-2 text-center">
                      <RemoveButton onClick={() => api.remove(line.tempKey)} title="Remove item" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[var(--color-border)] bg-slate-50/50 p-2 text-right">
        <button type="button" onClick={api.addBoughtOut} className="btn-secondary text-xs py-1 px-3">
          + Add Bought Out Item
        </button>
      </div>
    </div>
  );
}
