"use client";

import { formatMoney } from "@/lib/pricing.ts";
import type { CostSubcategoryWithVarieties } from "@/lib/types";
import { deleteCostSubcategory, deleteCostVariety } from "./actions";
import { Chevron, type MasterCtx } from "./master-ui";

export function SubcategoryBlock({
  sub,
  isMachine,
  ctx,
}: {
  sub: CostSubcategoryWithVarieties;
  isMachine: boolean;
  ctx: MasterCtx;
}) {
  const open = ctx.isOpen(sub.id);

  function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete subcategory "${sub.name}" and all its varieties?`)) return;
    ctx.run(() => deleteCostSubcategory(sub.id), `Subcategory "${sub.name}" deleted.`);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${open ? "border-b border-slate-100 pb-2 mb-2" : ""}`}
      >
        <button
          type="button"
          onClick={() => ctx.toggle(sub.id)}
          aria-expanded={open}
          className="flex items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <span className="font-semibold text-xs text-[var(--color-ink)]">
            Subcategory: <span className="text-[var(--color-brand-dark)] font-bold">{sub.name}</span>
          </span>
          <span className="text-[11px] text-[var(--color-muted)]">
            ({sub.varieties.length} {sub.varieties.length === 1 ? "variety" : "varieties"})
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              ctx.expand(sub.id);
              ctx.editVariety(sub.id, {
                unit: isMachine ? "min" : "sq ft",
                default_rate: isMachine ? 15 : 50,
                default_wastage_pct: isMachine ? 5 : 10,
              });
            }}
            className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-[var(--color-brand-dark)] hover:bg-emerald-100 transition-colors"
          >
            + Add Variety
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs text-red-500 hover:text-red-700"
            title="Delete Subcategory"
          >
            Delete
          </button>
        </div>
      </div>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[var(--color-muted)] font-medium">
                <th className="pb-1 font-semibold">Variety / Spec</th>
                <th className="pb-1 font-semibold">Default Rate</th>
                <th className="pb-1 font-semibold">Unit</th>
                <th className="pb-1 font-semibold">Default Wastage %</th>
                <th className="pb-1 font-semibold">Notes</th>
                <th className="pb-1 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sub.varieties.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-2 text-[var(--color-muted)] italic">
                    No varieties in {sub.name} yet. Click &ldquo;+ Add Variety&rdquo; above.
                  </td>
                </tr>
              ) : (
                sub.varieties.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-1.5 font-semibold text-[var(--color-ink)]">{v.name}</td>
                    <td className="py-1.5 font-mono font-semibold">{formatMoney(v.default_rate)}</td>
                    <td className="py-1.5 text-[var(--color-muted)]">{v.unit}</td>
                    <td className="py-1.5 text-[var(--color-muted)]">{v.default_wastage_pct}%</td>
                    <td className="py-1.5 text-[var(--color-muted)]">{v.notes ?? "—"}</td>
                    <td className="py-1.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => ctx.editVariety(sub.id, v)}
                          className="text-xs text-[var(--color-brand)] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`Are you sure you want to delete variety "${v.name}"?`)) return;
                            ctx.run(() => deleteCostVariety(v.id), `Variety "${v.name}" deleted.`);
                          }}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
