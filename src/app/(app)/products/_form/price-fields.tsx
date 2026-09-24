"use client";

import { useState } from "react";
import { round2, roundUpToNext10 } from "@/lib/pricing";
import type { Product } from "@/lib/types";

/** Cost price, markup % and selling price; markup and SP keep each other in step. */
export function PriceFields({ product }: { product?: Product }) {
  const [costPrice, setCostPrice] = useState(String(product?.cost_price ?? ""));
  const [markup, setMarkup] = useState(
    product?.markup_pct != null
      ? String(product.markup_pct)
      : product && product.cost_price > 0 && product.default_sp > 0
        ? String(round2(((product.default_sp - product.cost_price) / product.cost_price) * 100))
        : "100",
  );
  const [sellingPrice, setSellingPrice] = useState(String(product?.default_sp ?? ""));

  function applyMarkup() {
    const cp = Number(costPrice);
    const m = Number(markup);
    if (!Number.isFinite(cp) || !Number.isFinite(m)) return;
    setSellingPrice(String(roundUpToNext10(cp * (1 + m / 100))));
  }

  function handleSpChange(val: string) {
    setSellingPrice(val);
    const sp = Number(val);
    const cp = Number(costPrice);
    if (Number.isFinite(sp) && Number.isFinite(cp) && cp > 0 && sp > 0) {
      setMarkup(String(round2(((sp - cp) / cp) * 100)));
    }
  }

  function handleSpBlur() {
    if (sellingPrice) {
      const sp = Number(sellingPrice);
      if (Number.isFinite(sp) && sp > 0) {
        const rounded = roundUpToNext10(sp);
        setSellingPrice(String(rounded));
        const cp = Number(costPrice);
        if (Number.isFinite(cp) && cp > 0) {
          setMarkup(String(round2(((rounded - cp) / cp) * 100)));
        }
      }
    }
  }

  return (
    <>
      <div>
        <label className="label" htmlFor="cost_price">
          Cost price (₹)
        </label>
        <input
          id="cost_price"
          name="cost_price"
          inputMode="decimal"
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
          className="input input-num mt-1 font-mono"
        />
      </div>

      <div>
        <label className="label" htmlFor="markup_pct">
          Markup %
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="markup_pct"
            name="markup_pct"
            inputMode="decimal"
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
            className="input input-num font-mono"
          />
          <button type="button" onClick={applyMarkup} className="btn-secondary whitespace-nowrap">
            Apply
          </button>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="default_sp">
          Selling price (₹)
        </label>
        <input
          id="default_sp"
          name="default_sp"
          inputMode="decimal"
          value={sellingPrice}
          onChange={(e) => handleSpChange(e.target.value)}
          onBlur={handleSpBlur}
          className="input input-num mt-1 font-mono font-bold text-[var(--color-ink)]"
        />
      </div>
    </>
  );
}
