"use client";

import { codesForColors, type ProductColor } from "@/lib/product-code";
import type { ProductDetails } from "./use-product-details";

/** Product code with Auto-generate, and every per-colour code it will save as. */
export function CodeField({
  details,
  productColors,
}: {
  details: ProductDetails;
  productColors: ProductColor[];
}) {
  const { code, parsedCode, selectedColors } = details;
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label" htmlFor="calc-code">
          Product Code *
        </label>
        <button
          type="button"
          onClick={details.autoGenerateCode}
          className="text-[11px] text-[var(--color-brand)] hover:underline"
        >
          Auto-generate
        </button>
      </div>
      <input
        id="calc-code"
        value={code}
        onChange={(e) => details.setCode(e.target.value.toUpperCase())}
        placeholder="e.g. LC/0001/WL"
        required
        className="input mt-1 font-mono uppercase font-semibold"
      />
      {selectedColors.length > 1 && code.trim() ? (
        // Several colours save as one product each: show every code here
        <div className="mt-1.5 flex flex-wrap gap-1" title="One product is saved per color">
          {codesForColors(code, selectedColors).map((c) => (
            <span
              key={c.code}
              className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-800 border border-emerald-200"
            >
              <span
                className="h-2 w-2 rounded-full border border-black/20"
                style={{ backgroundColor: productColors.find((p) => p.name === c.color)?.hex }}
              />
              {c.code}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className={parsedCode.isValid ? "text-emerald-700 font-medium" : "text-amber-700"}>
            {parsedCode.isValid
              ? `✓ ${parsedCode.categoryCode}/${parsedCode.serial}/${parsedCode.colorCode} (${parsedCode.colorName})`
              : `Format: LC/0001/WL`}
          </span>
        </div>
      )}
    </div>
  );
}
