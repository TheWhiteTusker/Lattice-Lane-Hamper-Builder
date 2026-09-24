"use client";

import { parseProductCode } from "@/lib/product-code";

/** Product code with Auto-format and a live check of the LC/0001/WL format. */
export function CodeField({
  code,
  onChange,
  onAutoFormat,
}: {
  code: string;
  onChange: (code: string) => void;
  onAutoFormat: () => void;
}) {
  const parsed = parseProductCode(code);
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label" htmlFor="code">
          Product code *
        </label>
        <button type="button" onClick={onAutoFormat} className="text-[11px] text-[var(--color-brand)] hover:underline">
          Auto-format
        </button>
      </div>
      <input
        id="code"
        name="code"
        required
        value={code}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="e.g. LC/0001/WL"
        className="input mt-1 font-mono uppercase"
      />
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className={parsed.isValid ? "text-emerald-700 font-medium" : "text-amber-700"}>
          {parsed.isValid
            ? `✓ Valid: ${parsed.categoryCode}/${parsed.serial}/${parsed.colorCode} (${parsed.colorName})`
            : `Format: [CAT]/[0001]/[COLOR] (e.g. LC/0001/WL)`}
        </span>
      </div>
    </div>
  );
}
