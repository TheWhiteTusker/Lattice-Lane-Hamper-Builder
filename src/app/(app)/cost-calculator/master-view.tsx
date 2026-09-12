"use client";

import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/pricing.ts";
import {
  saveCostCategory,
  deleteCostCategory,
  saveCostSubcategory,
  deleteCostSubcategory,
  saveCostVariety,
  deleteCostVariety,
  saveProductColors,
} from "./actions";
import { COMMON_UNITS } from "@/lib/costing.ts";
import { STANDARD_PRODUCT_COLORS } from "@/lib/product-code";
import type { CostStageWithHierarchy, CostVariety } from "@/lib/types";

export function CostMasterView({
  stages,
  productColors,
}: {
  stages: CostStageWithHierarchy[];
  productColors: string[];
}) {
  const [isPending, startTransition] = useTransition();

  // Color management state
  const [colors, setColors] = useState<string[]>(productColors);
  const [newColor, setNewColor] = useState("");
  const [colorMsg, setColorMsg] = useState("");

  // Category addition state
  const [addingCatStageId, setAddingCatStageId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");

  // Subcategory addition state
  const [addingSubCatId, setAddingSubCatId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");

  // Variety addition / editing modal state
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string | null>(null);
  const [editingVariety, setEditingVariety] = useState<Partial<CostVariety> | null>(null);

  // Status/feedback
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});

  function handleAddColor() {
    if (!newColor.trim()) return;
    const trimmed = newColor.trim();
    if (colors.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setColorMsg("Color already exists.");
      return;
    }
    const updated = [...colors, trimmed];
    setColors(updated);
    setNewColor("");
    startTransition(async () => {
      await saveProductColors(updated);
      setColorMsg("Colors updated successfully.");
      setTimeout(() => setColorMsg(""), 3000);
    });
  }

  function handleRemoveColor(col: string) {
    const updated = colors.filter((c) => c !== col);
    setColors(updated);
    startTransition(async () => {
      await saveProductColors(updated);
      setColorMsg("Color removed.");
      setTimeout(() => setColorMsg(""), 3000);
    });
  }

  function handleAddCategory(stageId: string) {
    if (!newCatName.trim()) return;
    setFeedback({});
    startTransition(async () => {
      const fd = new FormData();
      fd.set("stage_id", stageId);
      fd.set("name", newCatName.trim());
      const res = await saveCostCategory(fd);
      if (res.error) {
        setFeedback({ error: res.error });
      } else {
        setNewCatName("");
        setAddingCatStageId(null);
        setFeedback({ success: "Category added successfully!" });
      }
    });
  }

  function handleDeleteCategory(id: string, name: string) {
    if (
      !window.confirm(
        `Are you sure you want to delete category "${name}" and all its subcategories and varieties?`,
      )
    )
      return;
    setFeedback({});
    startTransition(async () => {
      const res = await deleteCostCategory(id);
      if (res.error) setFeedback({ error: res.error });
      else setFeedback({ success: `Category "${name}" deleted.` });
    });
  }

  function handleAddSubcategory(categoryId: string) {
    if (!newSubName.trim()) return;
    setFeedback({});
    startTransition(async () => {
      const fd = new FormData();
      fd.set("category_id", categoryId);
      fd.set("name", newSubName.trim());
      const res = await saveCostSubcategory(fd);
      if (res.error) {
        setFeedback({ error: res.error });
      } else {
        setNewSubName("");
        setAddingSubCatId(null);
        setFeedback({ success: "Subcategory added successfully!" });
      }
    });
  }

  function handleDeleteSubcategory(id: string, name: string) {
    if (
      !window.confirm(
        `Are you sure you want to delete subcategory "${name}" and all its varieties?`,
      )
    )
      return;
    setFeedback({});
    startTransition(async () => {
      const res = await deleteCostSubcategory(id);
      if (res.error) setFeedback({ error: res.error });
      else setFeedback({ success: `Subcategory "${name}" deleted.` });
    });
  }

  function handleSaveVariety(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingVariety || !activeSubcategoryId) return;
    setFeedback({});

    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveCostVariety(fd);
      if (res.error) {
        setFeedback({ error: res.error });
      } else {
        setEditingVariety(null);
        setActiveSubcategoryId(null);
        setFeedback({ success: "Variety / Specification saved successfully!" });
      }
    });
  }

  function handleDeleteVariety(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to delete variety "${name}"?`)) return;
    setFeedback({});
    startTransition(async () => {
      const res = await deleteCostVariety(id);
      if (res.error) setFeedback({ error: res.error });
      else setFeedback({ success: `Variety "${name}" deleted.` });
    });
  }

  return (
    <div className="space-y-6">
      {/* ---------------- PRODUCT COLORS MASTER CARD ---------------- */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[var(--color-ink)]">
              Standard Product Colors & Finishes
            </h3>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              Each product comes strictly in 3 standard colors: <strong>Walnut (WL)</strong>, <strong>Natural (NT)</strong>, and <strong>Black (BL)</strong>.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
            3 Standard Finishes
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {STANDARD_PRODUCT_COLORS.map((c) => (
            <div
              key={c.code}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs"
            >
              <span
                className="h-7 w-7 rounded-full border border-black/20 shadow-xs shrink-0"
                style={{ backgroundColor: c.hex }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--color-ink)]">{c.name}</span>
                  <span className="rounded font-mono font-black text-xs bg-slate-100 px-1.5 py-0.5 text-slate-800">
                    {c.code}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--color-muted)]">Code suffix: /{c.code}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {colors.map((col) => (
            <span
              key={col}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--color-ink)] border border-slate-200"
            >
              {col}
              {!["Walnut", "Natural", "Black"].includes(col) && (
                <button
                  type="button"
                  onClick={() => handleRemoveColor(col)}
                  title={`Remove ${col}`}
                  className="ml-1 text-slate-400 hover:text-red-600 transition-colors"
                >
                  &times;
                </button>
              )}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 max-w-sm">
          <input
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            placeholder="New color (e.g. Teak, Mahogany)"
            className="input text-xs py-1.5"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddColor();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddColor}
            disabled={isPending || !newColor.trim()}
            className="btn-primary text-xs py-1.5 whitespace-nowrap"
          >
            + Add Color
          </button>
        </div>
        {colorMsg && (
          <p className="mt-2 text-xs font-medium text-emerald-700">{colorMsg}</p>
        )}
      </div>

      {/* Feedback banner */}
      {feedback.error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 border border-red-200"
        >
          {feedback.error}
        </div>
      )}
      {feedback.success && (
        <div
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800 border border-emerald-200"
        >
          {feedback.success}
        </div>
      )}

      {/* ---------------- 4-LEVEL HIERARCHY ACCORDION ---------------- */}
      {stages.map((stage) => {
        const isMachine = stage.code === "machine";

        return (
          <div key={stage.id} className="card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand)] text-xs font-bold text-white">
                    {stage.sort_order}
                  </span>
                  <h3 className="text-lg font-bold text-[var(--color-ink)]">
                    {stage.name} Master
                  </h3>
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                  Hierarchy: Category &rarr; Subcategory (e.g. Birch) &rarr; Varieties (e.g. 3mm, 8mm, 12mm)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAddingCatStageId(stage.id)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                + Add Category to {stage.name}
              </button>
            </div>

            {/* Inline add category box */}
            {addingCatStageId === stage.id && (
              <div className="rounded-lg border border-[var(--color-brand)] bg-emerald-50/50 p-3 flex flex-wrap items-center gap-3">
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder={`Category name under ${stage.name} (e.g. Woodbased, Magnets)`}
                  className="input text-xs py-1.5 max-w-xs"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleAddCategory(stage.id)}
                  disabled={isPending || !newCatName.trim()}
                  className="btn-primary text-xs py-1.5"
                >
                  Save Category
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCatStageId(null);
                    setNewCatName("");
                  }}
                  className="btn-secondary text-xs py-1.5"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Categories list */}
            <div className="space-y-4">
              {stage.categories.map((cat) => (
                <div
                  key={cat.id}
                  className="rounded-xl border border-[var(--color-border)] bg-slate-50/40 p-4 space-y-3"
                >
                  {/* Category Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--color-ink)] uppercase tracking-wide">
                        {cat.name}
                      </span>
                      <span className="badge text-[11px]">
                        {cat.subcategories.length}{" "}
                        {cat.subcategories.length === 1 ? "subcategory" : "subcategories"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAddingSubCatId(cat.id)}
                        className="btn-secondary text-xs py-1 px-2.5"
                      >
                        + Add Subcategory
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="text-xs text-red-600 hover:text-red-800 p-1"
                        title="Delete Category"
                      >
                        Delete Category
                      </button>
                    </div>
                  </div>

                  {/* Inline add subcategory box */}
                  {addingSubCatId === cat.id && (
                    <div className="rounded-lg border border-[var(--color-brand)] bg-white p-3 flex flex-wrap items-center gap-3">
                      <input
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        placeholder={`Subcategory under ${cat.name} (e.g. Birch, Rubberwood)`}
                        className="input text-xs py-1.5 max-w-xs"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleAddSubcategory(cat.id)}
                        disabled={isPending || !newSubName.trim()}
                        className="btn-primary text-xs py-1.5"
                      >
                        Save Subcategory
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingSubCatId(null);
                          setNewSubName("");
                        }}
                        className="btn-secondary text-xs py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Subcategories */}
                  {cat.subcategories.length === 0 ? (
                    <p className="text-xs text-[var(--color-muted)] italic py-2">
                      No subcategories in {cat.name} yet. Click &ldquo;+ Add Subcategory&rdquo; above.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {cat.subcategories.map((sub) => (
                        <div
                          key={sub.id}
                          className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-[var(--color-ink)]">
                                Subcategory: <span className="text-[var(--color-brand-dark)] font-bold">{sub.name}</span>
                              </span>
                              <span className="text-[11px] text-[var(--color-muted)]">
                                ({sub.varieties.length} {sub.varieties.length === 1 ? "variety" : "varieties"})
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSubcategoryId(sub.id);
                                  setEditingVariety({
                                    unit: isMachine ? "min" : "sq ft",
                                    default_rate: isMachine ? 15 : 50,
                                    default_wastage_pct: isMachine ? 5 : 10,
                                  });
                                }}
                                className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-[var(--color-brand-dark)] hover:bg-emerald-100 transition-colors"
                              >
                                + Add Variety
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubcategory(sub.id, sub.name)}
                                className="text-xs text-red-500 hover:text-red-700"
                                title="Delete Subcategory"
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {/* Varieties Table under this subcategory */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-100 text-[var(--color-muted)] font-medium">
                                  <th className="pb-1 font-semibold">Variety / Spec</th>
                                  <th className="pb-1 font-semibold">Default Rate</th>
                                  <th className="pb-1 font-semibold">Unit</th>
                                  <th className="pb-1 font-semibold">Default Wastage %</th>
                                  <th className="pb-1 font-semibold">Notes</th>
                                  <th className="pb-1 text-right font-semibold">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {sub.varieties.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="py-2 text-[var(--color-muted)] italic">
                                      No varieties in {sub.name} yet. Click &ldquo;+ Add Variety&rdquo; above.
                                    </td>
                                  </tr>
                                ) : (
                                  sub.varieties.map((v) => (
                                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="py-1.5 font-semibold text-[var(--color-ink)]">
                                        {v.name}
                                      </td>
                                      <td className="py-1.5 font-mono font-semibold">
                                        {formatMoney(v.default_rate)}
                                      </td>
                                      <td className="py-1.5 text-[var(--color-muted)]">
                                        {v.unit}
                                      </td>
                                      <td className="py-1.5 text-[var(--color-muted)]">
                                        {v.default_wastage_pct}%
                                      </td>
                                      <td className="py-1.5 text-[var(--color-muted)]">
                                        {v.notes ?? "—"}
                                      </td>
                                      <td className="py-1.5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveSubcategoryId(sub.id);
                                              setEditingVariety(v);
                                            }}
                                            className="text-xs text-[var(--color-brand)] hover:underline"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteVariety(v.id, v.name)}
                                            className="text-xs text-red-600 hover:underline"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* ---------------- MODAL / DIALOG TO ADD OR EDIT VARIETY ---------------- */}
      {editingVariety && activeSubcategoryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveVariety}
            className="card max-w-md w-full p-5 bg-white shadow-2xl space-y-4"
          >
            <input type="hidden" name="subcategory_id" value={activeSubcategoryId} />
            {editingVariety.id && <input type="hidden" name="id" value={editingVariety.id} />}

            <h3 className="text-base font-bold text-[var(--color-ink)]">
              {editingVariety.id ? "Edit Variety / Specification" : "New Variety / Specification"}
            </h3>

            <div>
              <label className="label" htmlFor="variety-name">
                Variety / Specification Name *
              </label>
              <input
                id="variety-name"
                name="name"
                defaultValue={editingVariety.name ?? ""}
                placeholder="e.g. 8mm, 12mm, 10x2mm, Matt"
                required
                className="input mt-1 text-sm font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="variety-rate">
                  Default Rate (₹) *
                </label>
                <input
                  id="variety-rate"
                  name="default_rate"
                  type="number"
                  step="any"
                  defaultValue={editingVariety.default_rate ?? 0}
                  required
                  className="input input-num mt-1 text-sm font-mono"
                />
              </div>

              <div>
                <label className="label" htmlFor="variety-unit">
                  Unit *
                </label>
                <select
                  id="variety-unit"
                  name="unit"
                  defaultValue={editingVariety.unit ?? "sq ft"}
                  required
                  className="select mt-1 text-sm"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  {editingVariety.unit &&
                    !COMMON_UNITS.includes(editingVariety.unit as (typeof COMMON_UNITS)[number]) && (
                      <option value={editingVariety.unit}>{editingVariety.unit}</option>
                    )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="variety-wastage">
                  Default Wastage %
                </label>
                <input
                  id="variety-wastage"
                  name="default_wastage_pct"
                  type="number"
                  step="any"
                  defaultValue={editingVariety.default_wastage_pct ?? 10}
                  className="input input-num mt-1 text-sm"
                />
              </div>

              <div>
                <label className="label" htmlFor="variety-sort">
                  Sort Order
                </label>
                <input
                  id="variety-sort"
                  name="sort_order"
                  type="number"
                  defaultValue={editingVariety.sort_order ?? 0}
                  className="input input-num mt-1 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="variety-notes">
                Notes / Specs
              </label>
              <input
                id="variety-notes"
                name="notes"
                defaultValue={editingVariety.notes ?? ""}
                placeholder="e.g. Grade B/BB Russian Birch, 12mm thickness"
                className="input mt-1 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => {
                  setEditingVariety(null);
                  setActiveSubcategoryId(null);
                }}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="btn-primary text-sm">
                {isPending ? "Saving…" : "Save Variety"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
