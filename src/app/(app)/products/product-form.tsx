"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveProduct, deleteProduct } from "./actions";
import { round2 } from "@/lib/pricing";
import type { Category, Product } from "@/lib/types";

export function ProductForm({
  product,
  categories,
  sources,
}: {
  product?: Product;
  categories: Category[];
  sources: string[];
}) {
  const [state, action, pending] = useActionState(saveProduct, {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteProduct, {});

  const [costPrice, setCostPrice] = useState(String(product?.cost_price ?? ""));
  const [margin, setMargin] = useState(
    product ? String(round2(product.target_margin * 100)) : "",
  );
  const [sellingPrice, setSellingPrice] = useState(String(product?.default_sp ?? ""));

  // Selling price is stored, not derived - the sheet worked that way, and real
  // catalogue prices get rounded to something sensible. This just does the
  // arithmetic so nobody reaches for a calculator.
  function applyMargin() {
    const cp = Number(costPrice);
    const m = Number(margin) / 100;
    if (!Number.isFinite(cp) || !Number.isFinite(m) || m >= 1) return;
    setSellingPrice(String(round2(cp / (1 - m))));
  }

  return (
    <>
      <form action={action} className="card max-w-2xl p-5">
        {product && <input type="hidden" name="id" value={product.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="code">
              Product code
            </label>
            <input
              id="code"
              name="code"
              required
              defaultValue={product?.code}
              className="input mt-1 font-mono"
            />
          </div>

          <div>
            <label className="label" htmlFor="category_id">
              Category
            </label>
            <select
              id="category_id"
              name="category_id"
              defaultValue={product?.category_id ?? ""}
              className="select mt-1"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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

          <div>
            <label className="label" htmlFor="cost_price">
              Cost price
            </label>
            <input
              id="cost_price"
              name="cost_price"
              inputMode="decimal"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              className="input input-num mt-1"
            />
          </div>

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
                className="input input-num"
              />
              <button type="button" onClick={applyMargin} className="btn-secondary">
                Apply
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="default_sp">
              Selling price
            </label>
            <input
              id="default_sp"
              name="default_sp"
              inputMode="decimal"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="input input-num mt-1"
            />
          </div>

          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={product ? product.is_active : true}
            />
            Active — available when building hampers
          </label>
        </div>

        {state.error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
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
