"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatMoney, formatPct, round2, num } from "@/lib/pricing.ts";
import {
  calculateLineCost,
  calculateCostSheetTotals,
  type DimensionUnit,
  COMMON_UNITS,
} from "@/lib/costing.ts";
import {
  formatProductCode,
  parseProductCode,
  getNextSerialForCategory,
  STANDARD_PRODUCT_COLORS,
  COLOR_TO_CODE,
  deriveCategoryCode,
} from "@/lib/product-code";
import {
  saveCostSheetAndProduct,
  getNextSerialAction,
  type SaveCostSheetPayload,
} from "./actions";
import { ProductImagesManager } from "@/components/product-images-manager";
import type {
  Category,
  CostStageWithHierarchy,
  Product,
  ProductCostLine,
  ProductCostSheet,
  ProductImage,
} from "@/lib/types";

type LineState = ProductCostLine & {
  tempKey: string;
};

const ORIGINS = ["In-house", "Outsource", "Hybrid"] as const;
const BOUGHT_OUT = "bought_out";

const createEmptyLine = (
  stageCode: string,
  categories: CostStageWithHierarchy["categories"],
): LineState => {
  const firstCat = categories[0];
  const firstSub = firstCat?.subcategories[0];
  const firstVar = firstSub?.varieties[0];

  return {
    id: crypto.randomUUID(),
    sheet_id: "",
    tempKey: crypto.randomUUID(),
    stage_code: stageCode,
    category_name: firstCat?.name ?? "",
    subcategory_name: firstSub?.name ?? "",
    variety_name: firstVar?.name ?? "",
    cost_variety_id: firstVar?.id ?? null,
    item_name:
      firstSub && firstVar ? `${firstSub.name} ${firstVar.name}` : firstSub?.name ?? "",
    length: null,
    breadth: null,
    dimension_unit: "inch",
    unit:
      firstVar?.unit ??
      (stageCode === "machine" ? "min" : categories.length > 0 ? "sq ft" : "piece"),
    rate: firstVar?.default_rate ?? 0,
    qty: 1,
    duration_minutes: stageCode === "machine" ? 15 : null,
    wastage_pct: firstVar?.default_wastage_pct ?? 0,
    sort_order: 0,
    calculated_area: 1,
    line_total: 0,
  };
};

export function CostCalculatorView({
  stages,
  categories,
  products,
  initialProduct,
  initialSheet,
  initialImages = [],
}: {
  stages: CostStageWithHierarchy[];
  categories: Category[];
  products: Product[];
  productColors?: string[];
  initialProduct?: Product | null;
  initialSheet?: ProductCostSheet | null;
  initialImages?: ProductImage[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Selected existing product or new
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProduct?.id ?? "",
  );
  const [code, setCode] = useState<string>(
    initialProduct?.code ?? initialSheet?.product_code ?? "",
  );
  const [name, setName] = useState<string>(
    initialProduct?.name ?? initialSheet?.product_name ?? "",
  );
  const [categoryId, setCategoryId] = useState<string>(
    initialProduct?.category_id ?? "",
  );
  const [source, setSource] = useState<string>(() => {
    const raw = initialProduct?.source ?? "In-house";
    return ORIGINS.find((o) => o.toLowerCase() === raw.toLowerCase()) ?? "In-house";
  });
  // Stage codes whose line table is hidden. Outsource collapses everything.
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(() =>
    (initialProduct?.source ?? "").toLowerCase() === "outsource"
      ? new Set(stages.map((s) => s.code))
      : new Set(),
  );
  const [selectedColors, setSelectedColors] = useState<string[]>(
    initialProduct?.colors ?? ["Walnut"],
  );
  const [isActive, setIsActive] = useState<boolean>(
    initialProduct ? initialProduct.is_active : true,
  );
  const [notes, setNotes] = useState<string>(initialSheet?.notes ?? "");

  // Markup & Selling Price state
  const [markupPct, setMarkupPct] = useState<string>(
    initialProduct?.markup_pct != null
      ? String(initialProduct.markup_pct)
      : initialSheet?.markup_pct != null
        ? String(initialSheet.markup_pct)
        : "100",
  );
  const [manualSp, setManualSp] = useState<string>(
    initialProduct?.default_sp != null
      ? String(initialProduct.default_sp)
      : initialSheet?.calculated_sp != null
        ? String(initialSheet.calculated_sp)
        : "",
  );

  const [feedback, setFeedback] = useState<{
    error?: string;
    success?: string;
  }>({});

  // Cost Lines State
  const [lines, setLines] = useState<LineState[]>(() => {
    if (initialSheet?.lines && initialSheet.lines.length > 0) {
      return initialSheet.lines.map((l) => ({
        ...l,
        tempKey: crypto.randomUUID(),
      }));
    }

    // Default with one line per stage to get started quickly
    return stages.map((s) => createEmptyLine(s.code, s.categories));
  });

  // Lookup map for stages and their categories
  const stageMap = useMemo(() => {
    return new Map(stages.map((s) => [s.code, s]));
  }, [stages]);

  // When user selects a product from the dropdown
  function handleSelectProduct(prodId: string) {
    setSelectedProductId(prodId);
    if (!prodId) {
      setCode("");
      setName("");
      setCategoryId("");
      setSelectedColors(["Walnut"]);
      setIsActive(true);
      setMarkupPct("100");
      setManualSp("");
      return;
    }

    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setCode(prod.code);
      setName(prod.name);
      setCategoryId(prod.category_id ?? "");
      handleOriginChange(
        ORIGINS.find((o) => o.toLowerCase() === (prod.source ?? "").toLowerCase()) ??
          "In-house",
      );
      setSelectedColors(prod.colors ?? []);
      setIsActive(prod.is_active);
      const mPct = prod.markup_pct != null ? String(prod.markup_pct) : "100";
      setMarkupPct(mPct);
      setManualSp(String(prod.default_sp));
      router.push(`/cost-calculator?product=${encodeURIComponent(prod.code)}`);
    }
  }

  // Product Origin drives which sections are shown and whether they start collapsed
  function handleOriginChange(origin: string) {
    setSource(origin);
    setCollapsedStages(
      origin === "Outsource" ? new Set(stages.map((s) => s.code)) : new Set(),
    );
  }

  function toggleStage(stageCode: string) {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageCode)) next.delete(stageCode);
      else next.add(stageCode);
      return next;
    });
  }

  // Update line field
  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.tempKey !== key) return l;
        const updated = { ...l, ...patch };

        // Recompute line total
        const calc = calculateLineCost(updated);
        return {
          ...updated,
          calculated_area: calc.calculated_area,
          line_total: calc.line_total,
        };
      }),
    );
  }

  // When Category changes -> cascade to first Subcategory -> first Variety
  function handleLineCategoryChange(key: string, stageCode: string, catName: string) {
    const stage = stageMap.get(stageCode);
    const cat = stage?.categories.find((c) => c.name === catName);
    const firstSub = cat?.subcategories[0];
    const firstVar = firstSub?.varieties[0];

    updateLine(key, {
      category_name: catName,
      subcategory_name: firstSub?.name ?? "",
      variety_name: firstVar?.name ?? "",
      item_name:
        firstSub && firstVar ? `${firstSub.name} ${firstVar.name}` : firstSub?.name ?? "",
      cost_variety_id: firstVar?.id ?? null,
      unit: firstVar?.unit ?? (stageCode === "machine" ? "min" : "sq ft"),
      rate: firstVar?.default_rate ?? 0,
      wastage_pct: firstVar?.default_wastage_pct ?? 0,
    });
  }

  // When Subcategory changes (e.g. Birch -> Acacia) -> cascade to first Variety (e.g. 10mm)
  function handleLineSubcategoryChange(
    key: string,
    stageCode: string,
    catName: string,
    subName: string,
  ) {
    const stage = stageMap.get(stageCode);
    const cat = stage?.categories.find((c) => c.name === catName);
    const sub = cat?.subcategories.find((s) => s.name === subName);
    const firstVar = sub?.varieties[0];

    updateLine(key, {
      subcategory_name: subName,
      variety_name: firstVar?.name ?? "",
      item_name: sub && firstVar ? `${sub.name} ${firstVar.name}` : sub?.name ?? "",
      cost_variety_id: firstVar?.id ?? null,
      unit: firstVar?.unit ?? (stageCode === "machine" ? "min" : "sq ft"),
      rate: firstVar?.default_rate ?? 0,
      wastage_pct: firstVar?.default_wastage_pct ?? 0,
    });
  }

  // When Variety changes (e.g. 8mm -> 12mm) -> update default rate, unit dropdown, and wastage
  function handleLineVarietyChange(
    key: string,
    stageCode: string,
    catName: string,
    subName: string,
    varName: string,
  ) {
    const stage = stageMap.get(stageCode);
    const cat = stage?.categories.find((c) => c.name === catName);
    const sub = cat?.subcategories.find((s) => s.name === subName);
    const v = sub?.varieties.find((x) => x.name === varName);

    if (v) {
      updateLine(key, {
        variety_name: varName,
        item_name: sub ? `${sub.name} ${v.name}` : varName,
        cost_variety_id: v.id,
        unit: v.unit,
        rate: v.default_rate,
        wastage_pct: v.default_wastage_pct,
      });
    } else {
      updateLine(key, {
        variety_name: varName,
        item_name: sub ? `${sub.name} ${varName}` : varName,
        cost_variety_id: null,
      });
    }
  }

  // Duplicate a line directly below it
  function duplicateLine(key: string) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.tempKey === key);
      if (idx < 0) return prev;
      const target = prev[idx];
      const cloned: LineState = {
        ...target,
        tempKey: crypto.randomUUID(),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, cloned);
      return next;
    });
  }

  // Remove a line
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.tempKey !== key));
  }

  // Add line to a specific stage
  function addLineToStage(stageCode: string) {
    const stage = stageMap.get(stageCode);
    if (!stage) return;
    const newLine = createEmptyLine(stageCode, stage.categories);
    setLines((prev) => [...prev, newLine]);
  }

  // Bought-out items (Hybrid only): a finished item purchased in, priced
  // rate x qty x (1 + markup%). wastage_pct carries the markup - same maths.
  function addBoughtOutLine() {
    setLines((prev) => [
      ...prev,
      { ...createEmptyLine(BOUGHT_OUT, []), category_name: "Bought Out" },
    ]);
  }

  // Bought-out lines only count while the product origin is Hybrid, so
  // switching origin does not silently keep charging for them.
  const boughtOutLines = lines.filter((l) => l.stage_code === BOUGHT_OUT);
  const activeLines = useMemo(
    () =>
      source !== "In-house"
        ? lines
        : lines.filter((l) => l.stage_code !== BOUGHT_OUT),
    [lines, source],
  );

  // Real-time totals
  const totals = useMemo(() => {
    return calculateCostSheetTotals(activeLines, num(markupPct));
  }, [activeLines, markupPct]);

  // Derived selling price
  const effectiveSp = manualSp ? num(manualSp) : totals.calculated_sp;
  const effectiveMargin =
    effectiveSp > 0 ? (effectiveSp - totals.total_cost) / effectiveSp : 0;

  // Handle markup % change
  function handleMarkupChange(val: string) {
    setMarkupPct(val);
    const m = num(val);
    const newSp = round2(totals.total_cost * (1 + m / 100));
    setManualSp(String(newSp));
  }

  // Handle manual Selling Price change
  function handleSpChange(val: string) {
    setManualSp(val);
    const sp = num(val);
    if (totals.total_cost > 0 && sp > 0) {
      const derivedMarkup = round2(((sp - totals.total_cost) / totals.total_cost) * 100);
      setMarkupPct(String(derivedMarkup));
    }
  }

  const parsedCode = parseProductCode(code);

  async function handleCategoryChange(newCatId: string) {
    setCategoryId(newCatId);
    const cat = categories.find((c) => c.id === newCatId);
    const catCode = cat?.code || (cat ? deriveCategoryCode(cat.name) : "LC");

    let serial = parsedCode.serial || "0001";
    if (!selectedProductId) {
      const existingCodes = products.map((p) => p.code);
      serial = getNextSerialForCategory(catCode, existingCodes);
      startTransition(async () => {
        const res = await getNextSerialAction(catCode);
        if (res.serial) {
          const colCode = parsedCode.colorCode || "WL";
          setCode(formatProductCode(catCode, res.serial, colCode));
        }
      });
    }
    const colCode = parsedCode.colorCode || "WL";
    setCode(formatProductCode(catCode, serial, colCode));
  }

  function handleColorSelect(colName: string) {
    setSelectedColors([colName]);
    const colCode = COLOR_TO_CODE[colName.toLowerCase()] || "WL";
    const cat = categories.find((c) => c.id === categoryId);
    const catCode = cat?.code || parsedCode.categoryCode || "LC";
    setCode(formatProductCode(catCode, parsedCode.serial || "0001", colCode));
  }

  // Save to Product Master
  function handleSave(allVariants: boolean = false) {
    setFeedback({});
    if (!code.trim()) {
      setFeedback({ error: "Product Code is required." });
      return;
    }
    if (!name.trim()) {
      setFeedback({ error: "Product Name is required." });
      return;
    }

    startTransition(async () => {
      const payload: SaveCostSheetPayload = {
        sheetId: initialSheet?.id ?? null,
        productId: selectedProductId || null,
        productCode: code.trim(),
        productName: name.trim(),
        categoryId: categoryId || null,
        source: source.trim() || null,
        colors: selectedColors,
        isActive,
        markupPct: num(markupPct),
        sellingPrice: effectiveSp,
        notes: notes.trim() || null,
        createAllColorVariants: allVariants,
        lines: activeLines.map((l) => ({
          stage_code: l.stage_code,
          category_name: l.category_name,
          subcategory_name: l.subcategory_name,
          variety_name: l.variety_name,
          item_name: l.item_name,
          cost_variety_id: l.cost_variety_id,
          length: l.length,
          breadth: l.breadth,
          dimension_unit: l.dimension_unit,
          unit: l.unit,
          rate: l.rate,
          duration_minutes: l.duration_minutes,
          qty: l.qty,
          wastage_pct: l.wastage_pct,
          calculated_area: l.calculated_area,
          line_total: l.line_total,
        })),
      };

      const res = await saveCostSheetAndProduct(payload);
      if (res.error) {
        setFeedback({ error: res.error });
      } else {
        const variantMsg =
          res.variants && res.variants.length > 0
            ? ` Generated all 3 variants (${res.variants.join(", ")}).`
            : "";
        setFeedback({
          success: `Saved successfully! Product ${res.productCode} updated with CP ${formatMoney(res.totalCost)} and SP ${formatMoney(res.sellingPrice)}.${variantMsg}`,
        });
        if (res.productId) setSelectedProductId(res.productId);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ---------------- PRODUCT DETAILS HEADER ---------------- */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
          <div className="flex items-center gap-3">
            {initialProduct?.image_url && (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-xs">
                <Image
                  src={initialProduct.image_url}
                  alt={name || "Product photo"}
                  fill
                  sizes="48px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-[var(--color-ink)]">
                Product & Costing Specification
              </h2>
              <p className="text-sm text-[var(--color-muted)]">
                Standard format: [CATEGORY]/[0001]/[COLOR] (e.g. LC/0001/WL). Each product comes in 3 colors only (Walnut, Natural, Black).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Load Existing:
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => handleSelectProduct(e.target.value)}
              className="select text-sm py-1.5 min-w-[220px]"
            >
              <option value="">-- Create New Product --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="calc-code">
                Product Code *
              </label>
              <button
                type="button"
                onClick={async () => {
                  const cat = categories.find((c) => c.id === categoryId);
                  const catCode = cat?.code || (cat ? deriveCategoryCode(cat.name) : "LC");
                  const res = await getNextSerialAction(catCode);
                  const col = selectedColors[0] || "Walnut";
                  setCode(formatProductCode(catCode, res.serial || "0001", col));
                }}
                className="text-[11px] text-[var(--color-brand)] hover:underline"
              >
                Auto-generate
              </button>
            </div>
            <input
              id="calc-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. LC/0001/WL"
              required
              className="input mt-1 font-mono uppercase font-semibold"
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span
                className={
                  parsedCode.isValid ? "text-emerald-700 font-medium" : "text-amber-700"
                }
              >
                {parsedCode.isValid
                  ? `✓ ${parsedCode.categoryCode}/${parsedCode.serial}/${parsedCode.colorCode} (${parsedCode.colorName})`
                  : `Format: LC/0001/WL`}
              </span>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="calc-category">
              Product Master Category
            </label>
            <select
              id="calc-category"
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="select mt-1"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `[${c.code}] ` : ""}{c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="calc-name">
              Product Name *
            </label>
            <input
              id="calc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lotus Glow (Pair)"
              required
              className="input mt-1"
            />
          </div>

          <div>
            <label className="label" htmlFor="calc-source">
              Product Origin
            </label>
            <select
              id="calc-source"
              value={source}
              onChange={(e) => handleOriginChange(e.target.value)}
              className="select mt-1"
            >
              {ORIGINS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">
              {source === "In-house"
                ? "All 5 cost stages apply."
                : source === "Outsource"
                  ? "Stages start collapsed — cost the vendor price under Bought Out Items below."
                  : "In-house stages plus bought-out items with their own markup."}
            </p>
          </div>
        </div>

        {/* Color Variants & Active status */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--color-ink)] mr-1">
              Color Finish (3 standard colors):
            </span>
            {STANDARD_PRODUCT_COLORS.map((col) => {
              const checked = selectedColors.includes(col.name);
              return (
                <button
                  key={col.code}
                  type="button"
                  onClick={() => handleColorSelect(col.name)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    checked
                      ? "bg-[var(--color-brand)] text-white shadow-sm ring-2 ring-[var(--color-brand)]/20"
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

          <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)] cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
            />
            <span>Active in Product Master & Hamper Builder</span>
          </label>
        </div>
      </div>

      {/* Product Photos & Color Finishes */}
      {selectedProductId ? (
        <div className="card p-5 shadow-sm">
          <ProductImagesManager
            key={selectedProductId}
            productId={selectedProductId}
            initialImages={initialImages}
            productName={name}
            currentColor={parsedCode.colorName || selectedColors[0] || "Walnut"}
          />
        </div>
      ) : (
        <div className="card p-4 border-dashed bg-slate-50/60 text-center text-xs text-[var(--color-muted)]">
          Save this product first to upload and manage photos for Walnut, Natural, and Black finishes.
        </div>
      )}

      {/* ---------------- STAGE SECTIONS ---------------- */}
      {stages.map((stage) => {
        const stageLines = lines.filter((l) => l.stage_code === stage.code);
        const stageSubtotal = stageLines.reduce((acc, l) => acc + l.line_total, 0);
        const isMachine = stage.code === "machine";
        // Stages with no categories configured (Miscellaneous) take a free-text
        // description instead of the Category -> Subcategory -> Variety selects.
        const hasCats = stage.categories.length > 0;
        const isCollapsed = collapsedStages.has(stage.code);
        const colCount =
          (hasCats ? 3 : 1) + (isMachine ? 1 : 3) + 1 + (isMachine ? 0 : 1) + 4;

        return (
          <div key={stage.id} className="card overflow-hidden shadow-sm">
            {/* Stage Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--color-sheet)] px-4 py-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleStage(stage.code)}
                  aria-expanded={!isCollapsed}
                  title={isCollapsed ? `Expand ${stage.name}` : `Collapse ${stage.name}`}
                  className="flex h-6 w-6 items-center justify-center rounded border border-[var(--color-border)] bg-white text-sm font-bold leading-none text-[var(--color-brand-dark)] shadow-xs transition-colors hover:bg-emerald-50"
                >
                  {isCollapsed ? "+" : "−"}
                </button>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-brand)] text-xs font-bold text-white">
                  {stage.sort_order}
                </span>
                <h3 className="text-base font-semibold text-[var(--color-ink)]">
                  {stage.name}
                </h3>
                <span className="text-xs text-[var(--color-muted)]">
                  {isCollapsed
                    ? `(Collapsed — ${stageLines.length} line${stageLines.length === 1 ? "" : "s"}, click + to edit)`
                    : isMachine
                      ? "(Billed per minute of machine operation)"
                      : hasCats
                        ? "(Category → Subcategory → Variety, dimensions & wastage)"
                        : "(Free-text description, rate & quantity)"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--color-muted)]">Stage Total:</span>
                <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-sm font-bold text-[var(--color-brand-dark)] shadow-sm">
                  {formatMoney(stageSubtotal)}
                </span>
              </div>
            </div>

            {/* Lines Table */}
            {!isCollapsed && (
            <>
            <div className="overflow-x-auto p-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)] font-semibold">
                    {hasCats ? (
                      <>
                        <th className="p-2 min-w-[130px]">Category</th>
                        <th className="p-2 min-w-[130px]">Subcategory</th>
                        <th className="p-2 min-w-[120px]">Variety</th>
                      </>
                    ) : (
                      <th className="p-2 min-w-[260px]">Description</th>
                    )}
                    {!isMachine && (
                      <>
                        <th className="p-2 min-w-[85px]">Length</th>
                        <th className="p-2 min-w-[85px]">Breadth</th>
                        <th className="p-2 min-w-[80px]">Dim Unit</th>
                      </>
                    )}
                    {isMachine && (
                      <th className="p-2 min-w-[110px]">Duration (Mins)</th>
                    )}
                    <th className="p-2 min-w-[85px]">
                      {isMachine ? "Rate / min" : "Rate / Unit"}
                    </th>
                    {!isMachine && <th className="p-2 min-w-[90px]">Unit</th>}
                    <th className="p-2 min-w-[65px]">Qty</th>
                    <th className="p-2 min-w-[75px]">Wastage %</th>
                    <th className="p-2 text-right min-w-[95px]">Total Cost</th>
                    <th className="p-2 text-center min-w-[100px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {stageLines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={colCount}
                        className="py-6 text-center text-sm text-[var(--color-muted)]"
                      >
                        No lines added for {stage.name}. Click &ldquo;+ Add Line&rdquo; below to start.
                      </td>
                    </tr>
                  ) : (
                    stageLines.map((line) => {
                      const selectedCat = stage.categories.find(
                        (c) => c.name === line.category_name,
                      );
                      const availableSubcategories = selectedCat?.subcategories ?? [];

                      const selectedSub = availableSubcategories.find(
                        (s) => s.name === line.subcategory_name,
                      );
                      const availableVarieties = selectedSub?.varieties ?? [];

                      return (
                        <tr
                          key={line.tempKey}
                          className="hover:bg-slate-50/75 transition-colors"
                        >
                          {hasCats ? (
                            <>
                          {/* 1. Category select */}
                            <td className="p-2">
                              <select
                                value={line.category_name}
                                onChange={(e) =>
                                  handleLineCategoryChange(
                                    line.tempKey,
                                    stage.code,
                                    e.target.value,
                                  )
                                }
                                className="select text-xs py-1 px-2"
                              >
                                {stage.categories.map((c) => (
                                  <option key={c.id} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </td>
  
                            {/* 2. Subcategory select (e.g. Birch, Acacia) */}
                            <td className="p-2">
                              <select
                                value={line.subcategory_name ?? ""}
                                onChange={(e) =>
                                  handleLineSubcategoryChange(
                                    line.tempKey,
                                    stage.code,
                                    line.category_name,
                                    e.target.value,
                                  )
                                }
                                className="select text-xs py-1 px-2 font-medium"
                              >
                                {availableSubcategories.map((s) => (
                                  <option key={s.id} value={s.name}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </td>
  
                            {/* 3. Variety select (e.g. 8mm, 12mm) */}
                            <td className="p-2">
                              <select
                                value={line.variety_name ?? ""}
                                onChange={(e) =>
                                  handleLineVarietyChange(
                                    line.tempKey,
                                    stage.code,
                                    line.category_name,
                                    line.subcategory_name ?? "",
                                    e.target.value,
                                  )
                                }
                                className="select text-xs py-1 px-2 font-semibold text-[var(--color-brand-dark)]"
                              >
                                {availableVarieties.map((v) => (
                                  <option key={v.id} value={v.name}>
                                    {v.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            </>
                          ) : (
                            /* Free-text description for category-less stages (Miscellaneous) */
                            <td className="p-2">
                              <input
                                value={line.item_name}
                                onChange={(e) =>
                                  updateLine(line.tempKey, { item_name: e.target.value })
                                }
                                placeholder="e.g. Courier packaging, ribbon, gift tag"
                                className="input text-xs py-1 px-2"
                              />
                            </td>
                          )}

                          {/* Dimensions for Material, Hardware, Finishing */}
                          {!isMachine && (
                            <>
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="any"
                                  value={line.length ?? ""}
                                  onChange={(e) =>
                                    updateLine(line.tempKey, {
                                      length: e.target.value ? Number(e.target.value) : null,
                                    })
                                  }
                                  placeholder="12"
                                  className="input input-num text-xs py-1 px-2"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="any"
                                  value={line.breadth ?? ""}
                                  onChange={(e) =>
                                    updateLine(line.tempKey, {
                                      breadth: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                    })
                                  }
                                  placeholder="12"
                                  className="input input-num text-xs py-1 px-2"
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  value={line.dimension_unit ?? "inch"}
                                  onChange={(e) =>
                                    updateLine(line.tempKey, {
                                      dimension_unit: e.target.value as DimensionUnit,
                                    })
                                  }
                                  className="select text-xs py-1 px-2"
                                >
                                  <option value="inch">Inch (&quot;)</option>
                                  <option value="mm">mm</option>
                                  <option value="cm">cm</option>
                                </select>
                              </td>
                            </>
                          )}

                          {/* Duration for Machine */}
                          {isMachine && (
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="any"
                                  value={line.duration_minutes ?? ""}
                                  onChange={(e) =>
                                    updateLine(line.tempKey, {
                                      duration_minutes: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                    })
                                  }
                                  placeholder="15"
                                  className="input input-num text-xs py-1 px-2"
                                />
                                <span className="text-[11px] text-[var(--color-muted)]">
                                  min
                                </span>
                              </div>
                            </td>
                          )}

                          {/* Rate */}
                          <td className="p-2">
                            <input
                              type="number"
                              step="any"
                              value={line.rate}
                              onChange={(e) =>
                                updateLine(line.tempKey, {
                                  rate: Number(e.target.value),
                                })
                              }
                              className="input input-num text-xs py-1 px-2 font-mono"
                            />
                          </td>

                          {/* Unit Dropdown */}
                          {!isMachine && (
                            <td className="p-2">
                              <select
                                value={line.unit}
                                onChange={(e) =>
                                  updateLine(line.tempKey, { unit: e.target.value })
                                }
                                className="select text-xs py-1 px-2"
                              >
                                {COMMON_UNITS.filter((u) => u !== "min" && u !== "hour").map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                                {line.unit &&
                                  !COMMON_UNITS.includes(line.unit as (typeof COMMON_UNITS)[number]) && (
                                    <option value={line.unit}>{line.unit}</option>
                                  )}
                              </select>
                            </td>
                          )}

                          {/* Quantity */}
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={line.qty}
                              onChange={(e) =>
                                updateLine(line.tempKey, {
                                  qty: Number(e.target.value),
                                })
                              }
                              className="input input-num text-xs py-1 px-2"
                            />
                          </td>

                          {/* Wastage % */}
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={line.wastage_pct}
                              onChange={(e) =>
                                updateLine(line.tempKey, {
                                  wastage_pct: Number(e.target.value),
                                })
                              }
                              className="input input-num text-xs py-1 px-2"
                            />
                          </td>

                          {/* Line Total */}
                          <td className="p-2 text-right font-mono font-semibold text-[var(--color-ink)]">
                            {formatMoney(line.line_total)}
                          </td>

                          {/* Actions: Duplicate & Delete */}
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => duplicateLine(line.tempKey)}
                                title="Duplicate this line (copy details to quick-edit)"
                                className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--color-brand)] hover:bg-emerald-50 hover:text-[var(--color-brand-dark)] transition-colors"
                              >
                                Duplicate
                              </button>
                              <button
                                type="button"
                                onClick={() => removeLine(line.tempKey)}
                                title="Remove line"
                                className="rounded px-1.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
                              >
                                &times;
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Stage Footer: Add Line Button */}
            <div className="border-t border-[var(--color-border)] bg-slate-50/50 p-2 text-right">
              <button
                type="button"
                onClick={() => addLineToStage(stage.code)}
                className="btn-secondary text-xs py-1 px-3"
              >
                + Add {stage.name} Line
              </button>
            </div>
            </>
            )}
          </div>
        );
      })}

      {/* ---------------- BOUGHT OUT ITEMS (HYBRID ONLY) ---------------- */}
      {source !== "In-house" && (
        <div className="card overflow-hidden shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-sheet)] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
                B
              </span>
              <h3 className="text-base font-semibold text-[var(--color-ink)]">
                Bought Out Items
              </h3>
              <span className="text-xs text-[var(--color-muted)]">
                (Finished items purchased in — Cost Price = Rate × Qty × (1 + Markup%))
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-muted)]">Bought Out Total:</span>
              <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-sm font-bold text-[var(--color-brand-dark)] shadow-sm">
                {formatMoney(boughtOutLines.reduce((acc, l) => acc + l.line_total, 0))}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto p-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] font-semibold text-[var(--color-muted)]">
                  <th className="p-2 min-w-[240px]">Material Name</th>
                  <th className="p-2 min-w-[95px]">Rate</th>
                  <th className="p-2 min-w-[110px]">Unit</th>
                  <th className="p-2 min-w-[70px]">Qty</th>
                  <th className="p-2 min-w-[90px]">Markup %</th>
                  <th className="p-2 min-w-[110px] text-right">Cost Price</th>
                  <th className="p-2 min-w-[70px] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {boughtOutLines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-6 text-center text-sm text-[var(--color-muted)]"
                    >
                      No bought-out items. Click &ldquo;+ Add Bought Out Item&rdquo; below to start.
                    </td>
                  </tr>
                ) : (
                  boughtOutLines.map((line) => (
                    <tr key={line.tempKey} className="transition-colors hover:bg-slate-50/75">
                      <td className="p-2">
                        <input
                          value={line.item_name}
                          onChange={(e) =>
                            updateLine(line.tempKey, { item_name: e.target.value })
                          }
                          placeholder="e.g. Ceramic diffuser bottle"
                          className="input text-xs py-1 px-2"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          value={line.rate}
                          onChange={(e) =>
                            updateLine(line.tempKey, { rate: Number(e.target.value) })
                          }
                          className="input input-num text-xs py-1 px-2 font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={line.unit}
                          onChange={(e) => updateLine(line.tempKey, { unit: e.target.value })}
                          className="select text-xs py-1 px-2"
                        >
                          {COMMON_UNITS.filter((u) => u !== "min" && u !== "hour").map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.qty}
                          onChange={(e) =>
                            updateLine(line.tempKey, { qty: Number(e.target.value) })
                          }
                          className="input input-num text-xs py-1 px-2"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.wastage_pct}
                          onChange={(e) =>
                            updateLine(line.tempKey, {
                              wastage_pct: Number(e.target.value),
                            })
                          }
                          className="input input-num text-xs py-1 px-2"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-semibold text-[var(--color-ink)]">
                        {formatMoney(line.line_total)}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.tempKey)}
                          title="Remove item"
                          className="rounded px-1.5 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-50"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[var(--color-border)] bg-slate-50/50 p-2 text-right">
            <button
              type="button"
              onClick={addBoughtOutLine}
              className="btn-secondary text-xs py-1 px-3"
            >
              + Add Bought Out Item
            </button>
          </div>
        </div>
      )}

      {/* ---------------- SUMMARY BREAKDOWN & PRICING PANEL ---------------- */}
      <div className="card p-5 bg-gradient-to-br from-white to-slate-50 border-2 border-[var(--color-brand)]/20 shadow-md">
        <h3 className="text-base font-bold text-[var(--color-ink)] mb-4">
          Cost Breakdown & Selling Price Master
        </h3>

        {/* Visual Stage Distribution Bar */}
        {totals.total_cost > 0 && (
          <div className="mb-6">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
              <div
                style={{
                  width: `${(totals.material_total / totals.total_cost) * 100}%`,
                }}
                className="bg-amber-600"
                title={`Material: ${formatMoney(totals.material_total)}`}
              />
              <div
                style={{
                  width: `${(totals.hardware_total / totals.total_cost) * 100}%`,
                }}
                className="bg-blue-600"
                title={`Hardware: ${formatMoney(totals.hardware_total)}`}
              />
              <div
                style={{
                  width: `${(totals.finishing_total / totals.total_cost) * 100}%`,
                }}
                className="bg-purple-600"
                title={`Finishing: ${formatMoney(totals.finishing_total)}`}
              />
              <div
                style={{
                  width: `${(totals.machine_total / totals.total_cost) * 100}%`,
                }}
                className="bg-teal-600"
                title={`Machine: ${formatMoney(totals.machine_total)}`}
              />
              <div
                style={{
                  width: `${(totals.other_total / totals.total_cost) * 100}%`,
                }}
                className="bg-amber-400"
                title={`Misc & Bought Out: ${formatMoney(totals.other_total)}`}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />
                Material: {formatMoney(totals.material_total)} (
                {formatPct(totals.material_total / totals.total_cost, 0)})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                Hardware: {formatMoney(totals.hardware_total)} (
                {formatPct(totals.hardware_total / totals.total_cost, 0)})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
                Finishing: {formatMoney(totals.finishing_total)} (
                {formatPct(totals.finishing_total / totals.total_cost, 0)})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-600" />
                Machine: {formatMoney(totals.machine_total)} (
                {formatPct(totals.machine_total / totals.total_cost, 0)})
              </span>
              {totals.other_total > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  Misc &amp; Bought Out: {formatMoney(totals.other_total)} (
                  {formatPct(totals.other_total / totals.total_cost, 0)})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Pricing Calculation Boxes */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
              Total Cost Price (CP)
            </span>
            <div className="mt-1 font-mono text-2xl font-black text-[var(--color-ink)]">
              {formatMoney(totals.total_cost)}
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">
              Sum of Material + HW + Finishing + Machine + Misc
              {source !== "In-house" ? " + Bought Out" : ""}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <label
              htmlFor="calc-markup"
              className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider"
            >
              Markup %
            </label>
            <div className="mt-1 flex items-center gap-1">
              <input
                id="calc-markup"
                type="number"
                step="any"
                value={markupPct}
                onChange={(e) => handleMarkupChange(e.target.value)}
                className="input input-num text-lg font-bold font-mono py-1"
              />
              <span className="text-base font-bold text-[var(--color-muted)]">%</span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">
              Selling Price = CP &times; (1 + Markup%)
            </p>
          </div>

          <div className="rounded-xl border border-[var(--color-brand)] bg-emerald-50/40 p-4 shadow-sm">
            <label
              htmlFor="calc-sp"
              className="text-xs font-semibold text-[var(--color-brand-dark)] uppercase tracking-wider"
            >
              Selling Price (SP)
            </label>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-lg font-bold text-[var(--color-brand-dark)]">₹</span>
              <input
                id="calc-sp"
                type="number"
                step="any"
                value={manualSp}
                onChange={(e) => handleSpChange(e.target.value)}
                placeholder={String(totals.calculated_sp)}
                className="input input-num text-lg font-black font-mono py-1 text-[var(--color-brand-dark)]"
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">
              Default catalogue price saved to product
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
              Target Margin
            </span>
            <div className="mt-1 font-mono text-2xl font-black text-emerald-700">
              {formatPct(effectiveMargin, 1)}
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">
              Margin = (SP &minus; CP) / SP
            </p>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-4">
          <label className="label" htmlFor="calc-notes">
            Costing Notes / Specifications
          </label>
          <input
            id="calc-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Requires 2 coats of PU polish, double-pass laser engraving on lid"
            className="input mt-1 text-sm"
          />
        </div>

        {/* Feedback alerts */}
        {feedback.error && (
          <div
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 border border-red-200"
          >
            {feedback.error}
          </div>
        )}
        {feedback.success && (
          <div
            role="status"
            className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800 border border-emerald-200"
          >
            {feedback.success}
          </div>
        )}

        {/* Actions bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] pt-4">
          <div className="flex items-center gap-2">
            <Link href="/products" className="btn-secondary">
              &larr; Back to Products
            </Link>
            {selectedProductId && (
              <Link
                href={`/products/${encodeURIComponent(code)}`}
                className="btn-secondary"
              >
                View in Product Master
              </Link>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isPending}
              className="btn-primary px-5 py-2.5 text-sm font-bold shadow"
            >
              {isPending ? "Saving Costing…" : `Save Product (${code || "Primary"})`}
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isPending}
              className="btn-secondary bg-emerald-50 text-[var(--color-brand-dark)] border-emerald-300 hover:bg-emerald-100 px-5 py-2.5 text-sm font-bold shadow-sm"
              title="Creates or updates all 3 color codes: /WL, /NT, and /BL with identical costing"
            >
              Save All 3 Color Variants (WL, NT, BL)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
