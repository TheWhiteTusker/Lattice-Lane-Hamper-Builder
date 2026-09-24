"use client";

import { useState } from "react";
import type { CostCategoryWithSubcategories } from "@/lib/types";
import { deleteCostCategory, saveCostSubcategory } from "./actions";
import { Chevron, InlineAdd, type MasterCtx } from "./master-ui";
import { SubcategoryBlock } from "./subcategory-block";

export function CategoryBlock({
  cat,
  isMachine,
  stageCode,
  ctx,
}: {
  cat: CostCategoryWithSubcategories;
  isMachine: boolean;
  stageCode?: string;
  ctx: MasterCtx;
}) {
  const [adding, setAdding] = useState(false);
  const open = ctx.isOpen(cat.id);
  const isBoughtOut = stageCode === "bought_out";

  function handleAdd(name: string) {
    const fd = new FormData();
    fd.set("category_id", cat.id);
    fd.set("name", name);
    ctx.run(() => saveCostSubcategory(fd), "Subcategory added successfully!", () => setAdding(false));
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Are you sure you want to delete category "${cat.name}" and all its subcategories and varieties?`,
      )
    )
      return;
    ctx.run(() => deleteCostCategory(cat.id), `Category "${cat.name}" deleted.`);
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-slate-50/40 p-4 space-y-3">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${open ? "border-b border-[var(--color-border)] pb-2" : ""}`}
      >
        <button
          type="button"
          onClick={() => ctx.toggle(cat.id)}
          aria-expanded={open}
          className="flex items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <span className="font-bold text-sm text-[var(--color-ink)] uppercase tracking-wide">
            {cat.name}
          </span>
          <span className="badge text-[11px]">
            {cat.subcategories.length}{" "}
            {cat.subcategories.length === 1 ? "subcategory" : "subcategories"}
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              ctx.expand(cat.id);
            }}
            className="btn-secondary text-xs py-1 px-2.5"
          >
            + Add Subcategory
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs text-red-600 hover:text-red-800 p-1"
            title="Delete Category"
          >
            Delete Category
          </button>
        </div>
      </div>

      {open && (
        <>
          {adding && (
            <InlineAdd
              placeholder={`Subcategory under ${cat.name} (e.g. ${isBoughtOut ? "Glass Bottles, Scented Candles" : "Birch, Rubberwood"})`}
              saveLabel="Save Subcategory"
              busy={ctx.isPending}
              className="bg-white"
              onSave={handleAdd}
              onCancel={() => setAdding(false)}
            />
          )}

          {cat.subcategories.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)] italic py-2">
              No subcategories in {cat.name} yet. Click &ldquo;+ Add Subcategory&rdquo; above.
            </p>
          ) : (
            <div className="space-y-3">
              {cat.subcategories.map((sub) => (
                <SubcategoryBlock
                  key={sub.id}
                  sub={sub}
                  isMachine={isMachine}
                  stageCode={stageCode}
                  ctx={ctx}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
