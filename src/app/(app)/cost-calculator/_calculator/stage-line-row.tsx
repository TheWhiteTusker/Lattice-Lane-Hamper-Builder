"use client";

import { formatMoney } from "@/lib/pricing.ts";
import { isTimeUnit, type DimensionUnit } from "@/lib/costing.ts";
import type { CostStageWithHierarchy } from "@/lib/types";
import { NumCell, RemoveButton, UnitCell } from "./cells";
import type { LineState } from "./lines";
import type { CostLines } from "./use-cost-lines";

function Pick({
  value,
  options,
  placeholder,
  disabled,
  className = "",
  onChange,
}: {
  value: string;
  options: { id: string; name: string }[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
  onChange: (name: string) => void;
}) {
  // A saved choice that has since been removed from the master stays visible, flagged.
  const missing = !!value && !options.some((o) => o.name === value);
  return (
    <td className="p-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`select text-xs py-1 px-2 ${missing ? "border-amber-400 text-amber-800" : ""} ${className}`}
        title={missing ? "No longer in the Rates & Hierarchy Master: pick a current option" : undefined}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {missing && <option value={value}>{value} (not in master)</option>}
        {options.map((o) => (
          <option key={o.id} value={o.name}>
            {o.name}
          </option>
        ))}
      </select>
    </td>
  );
}

export function StageLineRow({
  stage,
  line,
  api,
}: {
  stage: CostStageWithHierarchy;
  line: LineState;
  api: CostLines;
}) {
  const isMachine = stage.code === "machine";
  // Stages with a hierarchy take their rate and unit from the master.
  const fromMaster = stage.categories.length > 0;
  const sized = !isMachine || !isTimeUnit(line.unit || "min");
  const set = (patch: Partial<LineState>) => api.update(line.tempKey, patch);
  const cat = stage.categories.find((c) => c.name === line.category_name);
  const sub = cat?.subcategories.find((s) => s.name === line.subcategory_name);

  return (
    <tr className="hover:bg-slate-50/75 transition-colors">
      {stage.categories.length > 0 ? (
        <>
          <Pick
            value={line.category_name}
            options={stage.categories}
            placeholder="Select category…"
            onChange={(name) => api.setCategory(line.tempKey, name)}
          />
          <Pick
            value={line.subcategory_name ?? ""}
            options={cat?.subcategories ?? []}
            placeholder="Select…"
            disabled={!line.category_name}
            className="font-medium"
            onChange={(name) => api.setSubcategory(line.tempKey, name)}
          />
          <Pick
            value={line.variety_name ?? ""}
            options={sub?.varieties ?? []}
            placeholder="Select…"
            disabled={!line.subcategory_name}
            className="font-semibold text-[var(--color-brand-dark)]"
            onChange={(name) => api.setVariety(line, name)}
          />
        </>
      ) : (
        // Free-text description for category-less stages (Miscellaneous)
        <td className="p-2">
          <input
            value={line.item_name}
            onChange={(e) => set({ item_name: e.target.value })}
            placeholder={
              stage.code === "bought_out"
                ? "e.g. Water bottle, ceramic jar, chocolates"
                : "e.g. Courier packaging, ribbon, gift tag"
            }
            className="input text-xs py-1 px-2"
          />
        </td>
      )}

      {/* Machine rates can be per minute / hour (priced on duration) or by
          size (e.g. engraving per sq inch); only the fields that count are open. */}
      {sized ? (
        <>
          <NumCell
            value={line.length}
            nullable
            placeholder={stage.code === "bought_out" ? "—" : "12"}
            onChange={(length) => set({ length })}
          />
          <NumCell
            value={line.breadth}
            nullable
            placeholder={stage.code === "bought_out" ? "—" : "12"}
            onChange={(breadth) => set({ breadth })}
          />
          <td className="p-2">
            <select
              value={line.dimension_unit ?? "inch"}
              onChange={(e) => set({ dimension_unit: e.target.value as DimensionUnit })}
              className="select text-xs py-1 px-2"
            >
              <option value="inch">Inch (&quot;)</option>
              <option value="mm">mm</option>
              <option value="cm">cm</option>
            </select>
          </td>
        </>
      ) : (
        <td colSpan={3} className="p-2 text-center text-[11px] text-[var(--color-muted)]">
          Priced on time
        </td>
      )}
      {isMachine &&
        (sized ? (
          <td className="p-2 text-center text-[11px] text-[var(--color-muted)]">—</td>
        ) : (
          <td className="p-2">
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="any"
                value={line.duration_minutes ?? ""}
                onChange={(e) => set({ duration_minutes: e.target.value ? Number(e.target.value) : null })}
                placeholder="15"
                className="input input-num text-xs py-1 px-2"
              />
              <span className="text-[11px] text-[var(--color-muted)]">min</span>
            </div>
          </td>
        ))}

      {fromMaster ? (
        // The rate comes from the Rates & Hierarchy Master and is not edited here.
        <td className="p-2 whitespace-nowrap font-mono text-xs font-semibold" title="Set in the Rates & Hierarchy Master">
          {line.variety_name || line.rate ? `${formatMoney(line.rate)}/${line.unit}` : "—"}
        </td>
      ) : (
        <>
          <NumCell value={line.rate} mono onChange={(rate) => set({ rate: rate ?? 0 })} />
          <UnitCell value={line.unit} onChange={(unit) => set({ unit })} />
        </>
      )}
      <NumCell value={line.qty} min="0" onChange={(qty) => set({ qty: qty ?? 0 })} />
      {stage.code === "bought_out" ? (
        <td className="p-2 text-center text-xs text-[var(--color-muted)]" title="Bought-out items have 0% wastage">
          0%
        </td>
      ) : (
        <NumCell value={line.wastage_pct} min="0" onChange={(w) => set({ wastage_pct: w ?? 0 })} />
      )}

      <td className="p-2 text-right font-mono font-semibold text-[var(--color-ink)]">
        {formatMoney(line.line_total)}
      </td>
      <td className="p-2 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => api.duplicate(line.tempKey)}
            title="Duplicate this line (copy details to quick-edit)"
            className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--color-brand)] hover:bg-emerald-50 hover:text-[var(--color-brand-dark)] transition-colors"
          >
            Duplicate
          </button>
          <RemoveButton onClick={() => api.remove(line.tempKey)} title="Remove line" />
        </div>
      </td>
    </tr>
  );
}
