"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { saveHamper, duplicateHamper, deleteHamper } from "./actions";
import { priceHamper, formatMoney, formatPct, num, round2 } from "@/lib/pricing";
import type { Category, Hamper, HamperItem, Settings } from "@/lib/types";

/** The slice of Product Master the builder needs in the browser. */
export type CatalogProduct = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  counts_as_item: boolean;
  source: string | null;
  cost_price: number;
  target_margin: number;
  default_sp: number;
};

type Line = {
  key: string;
  product_id: string | null;
  product_code: string;
  product_name: string;
  category_name: string;
  source: string;
  qty: string;
  unit_cp: string;
  unit_sp: string;
  target_margin: string;
};

const blankLine = (): Line => ({
  key: crypto.randomUUID(),
  product_id: null,
  product_code: "",
  product_name: "",
  category_name: "",
  source: "",
  qty: "1",
  unit_cp: "",
  unit_sp: "",
  target_margin: "",
});

const toLine = (item: HamperItem): Line => ({
  key: crypto.randomUUID(),
  product_id: item.product_id,
  product_code: item.product_code ?? "",
  product_name: item.product_name,
  category_name: item.category_name ?? "",
  source: item.source ?? "",
  qty: String(item.qty),
  unit_cp: String(item.unit_cp),
  unit_sp: String(item.unit_sp),
  target_margin: String(round2(item.target_margin * 100)),
});

export function HamperBuilder({
  hamper,
  items,
  products,
  categories,
  settings,
  canEdit,
}: {
  hamper?: Hamper;
  items?: HamperItem[];
  products: CatalogProduct[];
  categories: Category[];
  settings: Settings;
  canEdit: boolean;
}) {
  const [state, action, saving] = useActionState(saveHamper, {});
  const [dupState, dupAction, duplicating] = useActionState(duplicateHamper, {});
  const [delState, delAction, deleting] = useActionState(deleteHamper, {});

  const [name, setName] = useState(hamper?.name ?? "");
  const [collection, setCollection] = useState(hamper?.collection ?? "");
  const [status, setStatus] = useState(hamper?.status ?? "Draft");
  const [notes, setNotes] = useState(hamper?.notes ?? "");
  const [targetSp, setTargetSp] = useState(
    hamper?.target_sp != null ? String(hamper.target_sp) : "",
  );
  const [discountPct, setDiscountPct] = useState(
    hamper ? String(round2(hamper.discount_pct * 100)) : "0",
  );
  const [finalSp, setFinalSp] = useState(
    hamper?.final_catalogue_sp != null ? String(hamper.final_catalogue_sp) : "",
  );

  const [lines, setLines] = useState<Line[]>(() =>
    items?.length ? items.map(toLine) : [blankLine()],
  );

  const countsAsItem = useMemo(() => {
    const map = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.counts_as_item]));
    // categoryCountsAsItem(): anything not listed in Settings counts.
    return (category: string) => map.get(category.trim().toLowerCase()) ?? true;
  }, [categories]);

  const totals = priceHamper(
    lines.map((l) => ({
      qty: num(l.qty),
      unitCp: num(l.unit_cp),
      unitSp: num(l.unit_sp),
      countsAsItem: countsAsItem(l.category_name),
    })),
    {
      discountPct: num(discountPct) / 100,
      targetSp: targetSp === "" ? null : num(targetSp),
      finalCatalogueSp: finalSp === "" ? null : num(finalSp),
    },
  );

  function update(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  /** Same job as populateProductRow() in the Apps Script. */
  function selectProduct(key: string, productId: string) {
    const p = products.find((x) => x.id === productId);

    if (!p) {
      update(key, { product_id: null, product_code: "", product_name: "" });
      return;
    }

    update(key, {
      product_id: p.id,
      product_code: p.code,
      product_name: p.name,
      category_name: p.category_name ?? "",
      source: p.source ?? "",
      unit_cp: String(p.cost_price),
      unit_sp: String(p.default_sp),
      target_margin: String(round2(p.target_margin * 100)),
    });
  }

  const payload = JSON.stringify({
    id: hamper?.id ?? null,
    name,
    collection: collection || null,
    status,
    target_sp: targetSp === "" ? null : num(targetSp),
    notes: notes || null,
    discount_pct: num(discountPct) / 100,
    final_catalogue_sp: finalSp === "" ? null : num(finalSp),
    lines: lines
      .filter((l) => l.product_name.trim() !== "")
      .map((l) => ({
        product_id: l.product_id,
        product_code: l.product_code || null,
        product_name: l.product_name,
        category_name: l.category_name || null,
        source: l.source || null,
        qty: num(l.qty),
        unit_cp: num(l.unit_cp),
        unit_sp: num(l.unit_sp),
        target_margin: num(l.target_margin) / 100,
      })),
  });

  const collections = useMemo(
    () =>
      Array.from(
        new Set([...settings.collections, collection].filter((v): v is string => !!v)),
      ),
    [settings.collections, collection],
  );

  return (
    <>
      <form action={action} className="space-y-4">
        <input type="hidden" name="payload" value={payload} />

        {/* ---------------- hamper information ---------------- */}
        <section className="card p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="label" htmlFor="name">
                Hamper name
              </label>
              <input
                id="name"
                className="input mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                className="select mt-1"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={!canEdit}
              >
                {Array.from(new Set([...settings.hamper_statuses, status])).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="collection">
                Collection / occasion
              </label>
              <input
                id="collection"
                list="collections"
                className="input mt-1"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                disabled={!canEdit}
              />
              <datalist id="collections">
                {collections.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="md:col-span-2">
              <label className="label" htmlFor="notes">
                Notes
              </label>
              <input
                id="notes"
                className="input mt-1"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
        </section>

        {/* ---------------- products ---------------- */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2.5">
            <h2 className="text-sm font-semibold">
              Products
              <span className="ml-2 font-normal text-[var(--color-muted)]">
                {lines.filter((l) => l.product_name).length} line
                {lines.filter((l) => l.product_name).length === 1 ? "" : "s"}
              </span>
            </h2>
            {canEdit && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setLines((prev) => [...prev, blankLine()])}
              >
                Add line
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="table min-w-[1000px]">
              <thead>
                <tr>
                  <th className="w-[170px]">Category</th>
                  <th className="w-[260px]">Product</th>
                  <th className="w-[110px]">Code</th>
                  <th className="w-[80px] num">Qty</th>
                  <th className="w-[110px] num">Unit cost</th>
                  <th className="w-[110px] num">Total cost</th>
                  <th className="w-[90px] num">Margin %</th>
                  <th className="w-[110px] num">Unit price</th>
                  <th className="w-[110px] num">Total price</th>
                  {canEdit && <th className="w-[40px]"></th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <LineRow
                    key={line.key}
                    line={line}
                    products={products}
                    categories={categories}
                    canEdit={canEdit}
                    onChange={(patch) => update(line.key, patch)}
                    onSelectProduct={(id) => selectProduct(line.key, id)}
                    onRemove={() =>
                      setLines((prev) =>
                        prev.length === 1
                          ? [blankLine()]
                          : prev.filter((l) => l.key !== line.key),
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------------- pricing ---------------- */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h2 className="text-sm font-semibold">Pricing</h2>

            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label="Total hamper cost" value={formatMoney(totals.totalCp)} />
              <Row label="Base selling price" value={formatMoney(totals.baseSp)} />
            </dl>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="discount">
                  Discount %
                </label>
                <input
                  id="discount"
                  inputMode="decimal"
                  className="input input-num mt-1"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  disabled={!canEdit}
                />
              </div>

              <div>
                <label className="label" htmlFor="targetSp">
                  Target selling price
                </label>
                <input
                  id="targetSp"
                  inputMode="decimal"
                  className="input input-num mt-1"
                  value={targetSp}
                  onChange={(e) => setTargetSp(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <dl className="mt-4 space-y-1.5 text-sm">
              <Row
                label="Selling price after discount"
                value={formatMoney(totals.spAfterDiscount)}
              />
              <Row
                label="Variance to target"
                value={totals.variance === null ? "—" : formatMoney(totals.variance)}
                tone={
                  totals.variance === null ? undefined : totals.variance < 0 ? "bad" : "good"
                }
              />
            </dl>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-semibold">Final catalogue price</h2>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Set by hand and kept as-is. Refreshing prices never overwrites it.
            </p>

            <div className="mt-3">
              <label className="label" htmlFor="finalSp">
                Final catalogue SP
              </label>
              <input
                id="finalSp"
                inputMode="decimal"
                className="input input-num mt-1 text-lg"
                value={finalSp}
                onChange={(e) => setFinalSp(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <dl className="mt-4 space-y-1.5 text-sm">
              <Row label="Items in hamper" value={String(round2(totals.numberOfItems))} />
              <Row
                label="Gross profit"
                value={totals.grossProfit === null ? "—" : formatMoney(totals.grossProfit)}
                tone={
                  totals.grossProfit === null
                    ? undefined
                    : totals.grossProfit < 0
                      ? "bad"
                      : "good"
                }
              />
              <Row
                label="Final margin"
                value={totals.finalMargin === null ? "—" : formatPct(totals.finalMargin)}
                tone={
                  totals.finalMargin === null
                    ? undefined
                    : totals.finalMargin < 0
                      ? "bad"
                      : "good"
                }
                strong
              />
            </dl>
          </div>
        </section>

        {(state.error || dupState.error || delState.error) && (
          <p role="alert" className="text-sm text-red-700">
            {state.error || dupState.error || delState.error}
          </p>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : hamper ? "Save changes" : "Create hamper"}
            </button>
            <Link href="/hampers" className="btn-secondary">
              Cancel
            </Link>
          </div>
        )}
      </form>

      {/* Kept outside the builder form so these never submit the hamper. */}
      {hamper && canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={`/quotes/new?hamper=${encodeURIComponent(hamper.code)}`} className="btn-secondary">
            Add to a quote
          </Link>

          <form action={dupAction}>
            <input type="hidden" name="code" value={hamper.code} />
            <button type="submit" className="btn-secondary" disabled={duplicating}>
              {duplicating ? "Duplicating…" : "Duplicate"}
            </button>
          </form>

          <form action={delAction} className="ml-auto">
            <input type="hidden" name="id" value={hamper.id} />
            <button type="submit" className="btn-danger" disabled={deleting}>
              {deleting ? "Deleting…" : "Delete hamper"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd
        className={[
          "tabular-nums",
          strong ? "text-base font-semibold" : "font-medium",
          tone === "bad" ? "text-red-700" : tone === "good" ? "text-green-800" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

function LineRow({
  line,
  products,
  categories,
  canEdit,
  onChange,
  onSelectProduct,
  onRemove,
}: {
  line: Line;
  products: CatalogProduct[];
  categories: Category[];
  canEdit: boolean;
  onChange: (patch: Partial<Line>) => void;
  onSelectProduct: (productId: string) => void;
  onRemove: () => void;
}) {
  // Filtering happens here in the browser. The spreadsheet rebuilt the dropdown
  // server-side on every category change, which is what made it feel slow.
  // ponytail: fine for a few thousand products; swap in a search box if the
  // catalogue ever outgrows a <select>.
  const options = useMemo(() => {
    if (!line.category_name) return products;
    const wanted = line.category_name.trim().toLowerCase();
    return products.filter((p) => (p.category_name ?? "").trim().toLowerCase() === wanted);
  }, [products, line.category_name]);

  const totalCp = num(line.qty) * num(line.unit_cp);
  const totalSp = num(line.qty) * num(line.unit_sp);

  return (
    <tr>
      <td>
        <select
          aria-label="Category"
          className="select"
          value={line.category_name}
          disabled={!canEdit}
          onChange={(e) => {
            const category = e.target.value;
            const stillMatches =
              !category ||
              products.find((p) => p.id === line.product_id)?.category_name === category;
            // Clearing a mismatched product mirrors the sheet's onEdit handler.
            onChange(
              stillMatches
                ? { category_name: category }
                : { category_name: category, product_id: null, product_code: "", product_name: "" },
            );
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </td>

      <td>
        <select
          aria-label="Product"
          className="select"
          value={line.product_id ?? ""}
          disabled={!canEdit}
          onChange={(e) => onSelectProduct(e.target.value)}
        >
          <option value="">Select a product…</option>
          {/* A product that has since been retired still shows on saved lines. */}
          {!line.product_id && line.product_name && (
            <option value="">{line.product_name} (no longer in Product Master)</option>
          )}
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </td>

      <td className="font-mono text-xs text-[var(--color-muted)]">{line.product_code || "—"}</td>

      <td>
        <input
          aria-label="Quantity"
          inputMode="decimal"
          className="input input-num"
          value={line.qty}
          disabled={!canEdit}
          onChange={(e) => onChange({ qty: e.target.value })}
        />
      </td>

      <td>
        <input
          aria-label="Unit cost"
          inputMode="decimal"
          className="input input-num"
          value={line.unit_cp}
          disabled={!canEdit}
          onChange={(e) => onChange({ unit_cp: e.target.value })}
        />
      </td>

      <td className="num text-[var(--color-muted)]">{totalCp ? formatMoney(totalCp) : "—"}</td>

      <td>
        <input
          aria-label="Target margin"
          inputMode="decimal"
          className="input input-num"
          value={line.target_margin}
          disabled={!canEdit}
          onChange={(e) => onChange({ target_margin: e.target.value })}
        />
      </td>

      <td>
        <input
          aria-label="Unit price"
          inputMode="decimal"
          className="input input-num"
          value={line.unit_sp}
          disabled={!canEdit}
          onChange={(e) => onChange({ unit_sp: e.target.value })}
        />
      </td>

      <td className="num font-medium">{totalSp ? formatMoney(totalSp) : "—"}</td>

      {canEdit && (
        <td className="num">
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${line.product_name || "line"}`}
            className="rounded px-1.5 py-0.5 text-[var(--color-muted)] hover:bg-red-50 hover:text-red-700"
          >
            ×
          </button>
        </td>
      )}
    </tr>
  );
}
