"use client";

import { parseProductCode } from "@/lib/product-code";

/** Product code: filled in from the category and colour, with a live check of the LC/0001/WL format. */
export function CodeField({
  code,
  onChange,
  fetching,
}: {
  code: string;
  onChange: (code: string) => void;
  /** Waiting for the next free serial in the chosen category. */
  fetching?: boolean;
}) {
  const parsed = parseProductCode(code);
  return (
    <div>
      <label className="label" htmlFor="code">
        Product code *
      </label>
      <input
        id="code"
        name="code"
        required
        value={code}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="Choose a category"
        className="input mt-1 font-mono uppercase"
      />
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className={parsed.isValid ? "text-emerald-700 font-medium" : "text-[var(--color-muted)]"}>
          {fetching
            ? "Finding the next number…"
            : parsed.isValid
              ? `✓ ${parsed.categoryCode}/${parsed.serial}/${parsed.colorCode} (${parsed.colorName})`
              : "Set automatically from the category and colour"}
        </span>
      </div>
    </div>
  );
}
