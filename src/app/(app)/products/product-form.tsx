"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveProduct, deleteProduct } from "./actions";
import { round2 } from "@/lib/pricing";
import {
  formatProductCode,
  parseProductCode,
  STANDARD_PRODUCT_COLORS,
  COLOR_TO_CODE,
  deriveCategoryCode,
} from "@/lib/product-code";
import { ProductImagesManager } from "@/components/product-images-manager";
import type { Category, Product, ProductImage } from "@/lib/types";

export function ProductForm({
  product,
  initialImages = [],
  categories,
  sources,
}: {
  product?: Product;
  initialImages?: ProductImage[];
  categories: Category[];
  sources: string[];
  allColors?: string[];
}) {
  const [state, action, pending] = useActionState(saveProduct, {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteProduct, {});

  const [code, setCode] = useState(product?.code ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [costPrice, setCostPrice] = useState(String(product?.cost_price ?? ""));
  const [markup, setMarkup] = useState(
    product?.markup_pct != null
      ? String(product.markup_pct)
      : product && product.cost_price > 0 && product.default_sp > 0
        ? String(round2(((product.default_sp - product.cost_price) / product.cost_price) * 100))
        : "100",
  );
  const [margin, setMargin] = useState(
    product ? String(round2(product.target_margin * 100)) : "",
  );
  const [sellingPrice, setSellingPrice] = useState(String(product?.default_sp ?? ""));
  const [selectedColors, setSelectedColors] = useState<string[]>(
    product?.colors && product.colors.length > 0 ? product.colors : ["Walnut"],
  );

  const parsedCode = parseProductCode(code);

  function applyMarkup(val?: string) {
    const cp = Number(costPrice);
    const m = Number(val ?? markup);
    if (!Number.isFinite(cp) || !Number.isFinite(m)) return;
    const sp = round2(cp * (1 + m / 100));
    setSellingPrice(String(sp));
    if (sp > 0) {
      setMargin(String(round2(((sp - cp) / sp) * 100)));
    }
  }

  function applyMargin(val?: string) {
    const cp = Number(costPrice);
    const m = Number(val ?? margin) / 100;
    if (!Number.isFinite(cp) || !Number.isFinite(m) || m >= 1) return;
    const sp = round2(cp / (1 - m));
    setSellingPrice(String(sp));
    if (cp > 0) {
      setMarkup(String(round2(((sp - cp) / cp) * 100)));
    }
  }

  function handleSpChange(val: string) {
    setSellingPrice(val);
    const sp = Number(val);
    const cp = Number(costPrice);
    if (Number.isFinite(sp) && Number.isFinite(cp) && cp > 0 && sp > 0) {
      setMarkup(String(round2(((sp - cp) / cp) * 100)));
      setMargin(String(round2(((sp - cp) / sp) * 100)));
    }
  }

  function toggleColor(col: string) {
    setSelectedColors((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  }

  function handleCategoryChange(newCatId: string) {
    setCategoryId(newCatId);
    const cat = categories.find((c) => c.id === newCatId);
    const catCode = cat?.code || (cat ? deriveCategoryCode(cat.name) : "LC");
    const currentParsed = parseProductCode(code);
    const colorCode =
      currentParsed.colorCode ||
      (selectedColors[0] ? COLOR_TO_CODE[selectedColors[0].toLowerCase()] : "WL");
    setCode(formatProductCode(catCode, currentParsed.serial || "0001", colorCode));
  }

  function handleColorSelect(colName: string) {
    toggleColor(colName);
    const colCode = COLOR_TO_CODE[colName.toLowerCase()] || "WL";
    const currentParsed = parseProductCode(code);
    const cat = categories.find((c) => c.id === categoryId);
    const catCode = cat?.code || currentParsed.categoryCode || "LC";
    setCode(formatProductCode(catCode, currentParsed.serial || "0001", colCode));
  }

  return (
    <>
      {product && (
        <div className="mb-4 max-w-2xl flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50/70 p-4 border border-[var(--color-brand)]/30">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-brand-dark)]">
              Multi-Stage Costing
            </span>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              Break down this product into Material, Hardware, Finishing & Machine per-minute costs.
            </p>
          </div>
          <Link
            href={`/cost-calculator?product=${encodeURIComponent(product.code)}`}
            className="btn-primary text-xs py-1.5 px-3"
          >
            Open in Cost Calculator &rarr;
          </Link>
        </div>
      )}

      <form action={action} className="card max-w-2xl p-5">
        {product && <input type="hidden" name="id" value={product.id} />}
        {selectedColors.map((col) => (
          <input key={col} type="hidden" name="colors" value={col} />
        ))}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="code">
                Product code *
              </label>
              <button
                type="button"
                onClick={() => {
                  const cat = categories.find((c) => c.id === categoryId);
                  const catCode = cat?.code || (cat ? deriveCategoryCode(cat.name) : "LC");
                  const col = selectedColors[0] || "Walnut";
                  setCode(formatProductCode(catCode, parsedCode.serial || "0001", col));
                }}
                className="text-[11px] text-[var(--color-brand)] hover:underline"
              >
                Auto-format
              </button>
            </div>
            <input
              id="code"
              name="code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. LC/0001/WL"
              className="input mt-1 font-mono uppercase"
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span
                className={
                  parsedCode.isValid ? "text-emerald-700 font-medium" : "text-amber-700"
                }
              >
                {parsedCode.isValid
                  ? `✓ Valid: ${parsedCode.categoryCode}/${parsedCode.serial}/${parsedCode.colorCode} (${parsedCode.colorName})`
                  : `Format: [CAT]/[0001]/[COLOR] (e.g. LC/0001/WL)`}
              </span>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="category_id">
              Category
            </label>
            <select
              id="category_id"
              name="category_id"
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="select mt-1"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `[${c.code}] ` : ""}{c.name}
                  {c.counts_as_item ? "" : " (not counted as an item)"}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="name">
              Product name
            </label>
            <input
              id="name"
              name="name"
              required
              defaultValue={product?.name}
              className="input mt-1"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="source">
              Source / vendor
            </label>
            <input
              id="source"
              name="source"
              list="sources"
              defaultValue={product?.source ?? ""}
              className="input mt-1"
            />
            <datalist id="sources">
              {sources.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* Color Selection */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="label">Available Colors / Finishes (3 only)</label>
              <span className="text-xs text-[var(--color-muted)]">
                Walnut (WL), Natural (NT), Black (BL)
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {STANDARD_PRODUCT_COLORS.map((col) => {
                const checked = selectedColors.includes(col.name);
                return (
                  <button
                    key={col.code}
                    type="button"
                    onClick={() => handleColorSelect(col.name)}
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      checked
                        ? "bg-[var(--color-brand)] text-white shadow-sm"
                        : "bg-[var(--color-sheet)] text-[var(--color-muted)] hover:bg-slate-200"
                    }`}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full border border-black/20"
                      style={{ backgroundColor: col.hex }}
                    />
                    <span>
                      {col.name} ({col.code})
                    </span>
                    {checked && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cost Price */}
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

          {/* Markup % */}
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
              <button
                type="button"
                onClick={() => applyMarkup()}
                className="btn-secondary whitespace-nowrap"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Target Margin % */}
          <div>
            <label className="label" htmlFor="target_margin">
              Target margin %
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="target_margin"
                name="target_margin"
                inputMode="decimal"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                className="input input-num font-mono"
              />
              <button
                type="button"
                onClick={() => applyMargin()}
                className="btn-secondary whitespace-nowrap"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Selling Price */}
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
              className="input input-num mt-1 font-mono font-bold text-[var(--color-ink)]"
            />
          </div>

          <label className="sm:col-span-2 flex items-center gap-2 py-1 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={product ? product.is_active : true}
              className="h-4 w-4 rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
            />
            <span className="font-medium">Active — available when building hampers</span>
          </label>
        </div>

        {state.error && (
          <p role="alert" className="mt-4 text-sm text-red-700 font-medium">
            {state.error}
          </p>
        )}

        <div className="mt-5 flex items-center gap-2">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : product ? "Save changes" : "Create product"}
          </button>
          <Link href="/products" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>

      {/* Product Images & Color Finishes Gallery */}
      <div className="card max-w-2xl p-5 mt-4">
        <ProductImagesManager
          productId={product?.id}
          initialImages={initialImages}
          productName={product?.name}
          currentColor={selectedColors[0] || "Walnut"}
        />
      </div>

      {product && (
        <form action={deleteAction} className="mt-4 max-w-2xl">
          <input type="hidden" name="id" value={product.id} />
          {deleteState.error && (
            <p role="alert" className="mb-2 text-sm text-red-700">
              {deleteState.error}
            </p>
          )}
          <button type="submit" className="btn-danger" disabled={deleting}>
            {deleting ? "Deleting…" : "Delete product"}
          </button>
        </form>
      )}
    </>
  );
}
