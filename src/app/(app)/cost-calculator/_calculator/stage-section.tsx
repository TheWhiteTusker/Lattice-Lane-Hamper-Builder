"use client";

import { withOverhead } from "@/lib/costing.ts";
import { formatMoney, num } from "@/lib/pricing.ts";
import type { CostStageWithHierarchy } from "@/lib/types";
import { OverheadInput, SectionHeader } from "./cells";
import { StageLineRow } from "./stage-line-row";
import type { CostLines } from "./use-cost-lines";

export function StageSection({
  stage,
  api,
  collapsed,
  onToggle,
  overhead,
  onOverhead,
}: {
  stage: CostStageWithHierarchy;
  api: CostLines;
  collapsed: boolean;
  onToggle: () => void;
  /** Overhead % as typed, added to this stage's subtotal. */
  overhead: string;
  onOverhead: (pct: string) => void;
}) {
  const stageLines = api.lines.filter((l) => l.stage_code === stage.code);
  const linesTotal = stageLines.reduce((acc, l) => acc + l.line_total, 0);
  const stageTotal = withOverhead(linesTotal, overhead);
  const isMachine = stage.code === "machine";
  // Stages with no categories configured (Miscellaneous) take a free-text
  // description instead of the Category -> Subcategory -> Variety selects.
  const hasCats = stage.categories.length > 0;
  const colCount = (hasCats ? 3 : 1) + (isMachine ? 1 : 3) + 1 + (isMachine ? 0 : 1) + 4;

  return (
    <div className="card overflow-hidden shadow-sm">
      <SectionHeader
        lead={
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            title={collapsed ? `Expand ${stage.name}` : `Collapse ${stage.name}`}
            className="flex h-6 w-6 items-center justify-center rounded border border-[var(--color-border)] bg-white text-sm font-bold leading-none text-[var(--color-brand-dark)] shadow-xs transition-colors hover:bg-emerald-50"
          >
            {collapsed ? "+" : "−"}
          </button>
        }
        badge={
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-brand)] text-xs font-bold text-white">
            {stage.sort_order}
          </span>
        }
        title={stage.name}
        hint={
          collapsed
            ? `(Collapsed — ${stageLines.length} line${stageLines.length === 1 ? "" : "s"}, click + to edit)`
            : isMachine
              ? "(Billed per minute of machine operation)"
              : hasCats
                ? "(Category → Subcategory → Variety, dimensions & wastage)"
                : "(Free-text description, rate & quantity)"
        }
        extra={
          <OverheadInput
            stageName={stage.name}
            value={overhead}
            added={num(overhead) ? formatMoney(stageTotal - linesTotal) : null}
            onChange={onOverhead}
          />
        }
        totalLabel="Stage Total:"
        total={formatMoney(stageTotal)}
      />

      {!collapsed && (
        <>
          <div className="overflow-x-auto p-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)] font-semibold">
                  {hasCats ? (
                    <>
                      <th className="p-2 min-w-[130px]">Category</th>
                      <th className="p-2 min-w-[130px]">Subcategory</th>
                      <th className="p-2 min-w-[120px]">Variety</th>
                    </>
                  ) : (
                    <th className="p-2 min-w-[260px]">Description</th>
                  )}
                  {isMachine ? (
                    <th className="p-2 min-w-[110px]">Duration (Mins)</th>
                  ) : (
                    <>
                      <th className="p-2 min-w-[85px]">Length</th>
                      <th className="p-2 min-w-[85px]">Breadth</th>
                      <th className="p-2 min-w-[80px]">Dim Unit</th>
                    </>
                  )}
                  <th className="p-2 min-w-[85px]">{isMachine ? "Rate / min" : "Rate / Unit"}</th>
                  {!isMachine && <th className="p-2 min-w-[90px]">Unit</th>}
                  <th className="p-2 min-w-[65px]">Qty</th>
                  <th className="p-2 min-w-[75px]">Wastage %</th>
                  <th className="p-2 text-right min-w-[95px]">Total Cost</th>
                  <th className="p-2 text-center min-w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {stageLines.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="py-6 text-center text-sm text-[var(--color-muted)]">
                      No lines added for {stage.name}. Click &ldquo;+ Add Line&rdquo; below to start.
                    </td>
                  </tr>
                ) : (
                  stageLines.map((line) => (
                    <StageLineRow key={line.tempKey} stage={stage} line={line} api={api} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[var(--color-border)] bg-slate-50/50 p-2 text-right">
            <button
              type="button"
              onClick={() => api.addToStage(stage.code)}
              className="btn-secondary text-xs py-1 px-3"
            >
              + Add {stage.name} Line
            </button>
          </div>
        </>
      )}
    </div>
  );
}
