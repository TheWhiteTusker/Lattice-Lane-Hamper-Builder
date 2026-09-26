"use client";

import type { CostSheetTotals } from "@/lib/costing";
import { formatMoney, formatPct } from "@/lib/pricing";

/** Stage share of the cost price, as one stacked bar with a legend. */
export function CostBreakdown({ totals }: { totals: CostSheetTotals }) {
  if (totals.total_cost <= 0) return null;
  const parts = [
    { label: "Material", value: totals.material_total, color: "bg-amber-600" },
    { label: "Hardware", value: totals.hardware_total, color: "bg-blue-600" },
    { label: "Finishing", value: totals.finishing_total, color: "bg-purple-600" },
    { label: "Machine", value: totals.machine_total, color: "bg-teal-600" },
    { label: "Misc & Bought Out", value: totals.other_total, color: "bg-amber-400", optional: true },
  ];

  return (
    <div className="mb-6">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
        {parts.map((p) => (
          <div
            key={p.label}
            style={{ width: `${(p.value / totals.total_cost) * 100}%` }}
            className={p.color}
            title={`${p.label}: ${formatMoney(p.value)}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs">
        {parts
          .filter((p) => !p.optional || p.value > 0)
          .map((p) => (
            <span key={p.label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${p.color}`} />
              {p.label}: {formatMoney(p.value)} ({formatPct(p.value / totals.total_cost, 0)})
            </span>
          ))}
      </div>
    </div>
  );
}
