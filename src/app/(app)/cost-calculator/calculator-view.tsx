"use client";

import { useCallback, useState, useMemo, useTransition } from "react";
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
  colorCode,
  codesForColors,
  deriveCategoryCode,
  type ProductColor,
} from "@/lib/product-code";
import {
  saveCostSheetAndProduct,
  getNextSerialAction,
  type SaveCostSheetPayload,
} from "./actions";
import { ProductImagesManager } from "@/components/product-images-manager";
import { uploadProductImage } from "@/app/(app)/products/image-actions";
import { ImagePreview } from "@/components/image-preview";
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
  // Nothing preselected: the user picks category, subcategory and variety.
  const line: LineState = {
    id: crypto.randomUUID(),
    sheet_id: "",
    tempKey: crypto.randomUUID(),
    stage_code: stageCode,
    category_name: "",
    subcategory_name: "",
    variety_name: "",
    cost_variety_id: null,
    item_name: "",
    length: null,
    breadth: null,
    dimension_unit: "inch",
    unit: stageCode === "machine" ? "min" : categories.length > 0 ? "sq ft" : "piece",
    rate: 0,
    qty: 1,
    duration_minutes: stageCode === "machine" ? 15 : null,
    wastage_pct: 0,
    sort_order: 0,
    calculated_area: 1,
    line_total: 0,
  };
  // The row must show the same amount the totals count for it.
  return { ...line, line_total: calculateLineCost(line).line_total };
};

export function CostCalculatorView({
  stages,
  categories,
  products,
  productColors = [],
  initialProduct,
  initialSheet,
  initialImages = [],
  savedCodes,
}: {
  stages: CostStageWithHierarchy[];
  categories: Category[];
  products: Product[];
  productColors?: ProductColor[];
  initialProduct?: Product | null;
  initialSheet?: ProductCostSheet | null;
  initialImages?: ProductImage[];
  /** Codes from the save that reset this page, shown as a banner. */
  savedCodes?: string;
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
        : "50",
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

  // Photos for the colour rows; the gallery below reports its own edits back.
  const [images, setImages] = useState<ProductImage[]>(initialImages);
  // Bumped after a row upload so the gallery remounts with the new photos.
  const [photoVersion, setPhotoVersion] = useState(0);
  // Colour -> product id once a multi-colour save has split the product.
  const [variantIds, setVariantIds] = useState<Record<string, string>>({});
  const productIdFor = (colName: string) => variantIds[colName] ?? selectedProductId;
  // The gallery only manages this product's photos; keep sibling colours' ones.
  const handleGalleryChange = useCallback(
    (gallery: ProductImage[]) =>
      setImages((prev) => [
        ...prev.filter((img) => img.product_id !== selectedProductId),
        ...gallery,
      ]),
    [selectedProductId],
  );
  // Photos picked before the product's first save. A photo row needs the
  // product's id, so these wait in the browser and upload right after saving.
  const [pending, setPending] = useState<{ key: string; color: string; file: File; url: string }[]>(
    [],
  );
  const [upload, setUpload] = useState<{
    color: string;
    busy?: boolean;
    error?: string;
    ok?: string;
  } | null>(null);

  // Cost Lines State
  const [lines, setLines] = useState<LineState[]>(() => {
    if (initialSheet?.lines && initialSheet.lines.length > 0) {
      return initialSheet.lines.map((l) => ({
        ...l,
        tempKey: crypto.randomUUID(),
      }));
    }

    // One empty row per stage, ready to be filled from the dropdowns.
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
      setMarkupPct("50");
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
      const mPct = prod.markup_pct != null ? String(prod.markup_pct) : "50";
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

  // Category changed: clear subcategory and variety so each is picked in turn.
  function handleLineCategoryChange(key: string, catName: string) {
    updateLine(key, {
      category_name: catName,
      subcategory_name: "",
      variety_name: "",
      item_name: "",
      cost_variety_id: null,
      rate: 0,
      wastage_pct: 0,
    });
  }

  // Subcategory changed: clear the variety; picking one fills rate and unit.
  function handleLineSubcategoryChange(key: string, subName: string) {
    updateLine(key, {
      subcategory_name: subName,
      variety_name: "",
      item_name: subName,
      cost_variety_id: null,
      rate: 0,
      wastage_pct: 0,
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
  // rate x qty; only the sheet-level markup applies.
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
    const divisor = 1 - m / 100;
    // 100%+ has no finite SP; leave the price alone rather than show Infinity
    if (divisor <= 0) return;
    setManualSp(String(round2(totals.total_cost / divisor)));
  }

  // Handle manual Selling Price change
  function handleSpChange(val: string) {
    setManualSp(val);
    const sp = num(val);
    if (totals.total_cost > 0 && sp > 0) {
      const derivedMarkup = round2(((sp - totals.total_cost) / sp) * 100);
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

  // Multi-select: a product can come in several finishes. The code suffix
  // follows the first selected one.
  function handleColorSelect(colName: string) {
    const next = selectedColors.includes(colName)
      ? selectedColors.filter((c) => c !== colName)
      : [...selectedColors, colName];
    setSelectedColors(next);
    if (!next[0]) return;
    const cat = categories.find((c) => c.id === categoryId);
    const catCode = cat?.code || parsedCode.categoryCode || "LC";
    setCode(formatProductCode(catCode, parsedCode.serial || "0001", colorCode(next[0])));
  }

  // Uploads files for one colour. Returns what landed and the first error.
  async function uploadFiles(productId: string, colName: string, files: File[], existing: number) {
    const added: ProductImage[] = [];
    for (const [i, file] of files.entries()) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("productId", productId);
      fd.append("color", colName);
      // First photo of a product with none becomes its cover
      fd.append("isPrimary", String(existing + added.length === 0 && i === 0));
      const res = await uploadProductImage(fd).catch((e: unknown) => ({
        error: e instanceof Error ? e.message : "Upload failed.",
        image: undefined,
      }));
      if (res.error || !res.image) return { added, error: res.error ?? "Upload failed." };
      added.push(res.image);
    }
    return { added, error: "" };
  }

  // Upload photos from a colour row, tagged with that colour. Status shows on
  // the row itself so a failure is never silent. Before the first save the
  // photos are queued and uploaded by handleSave.
  async function handleColorUpload(colName: string, input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (!files.length) return;
    if (!selectedColors.includes(colName)) handleColorSelect(colName);

    if (!selectedProductId) {
      setPending((prev) => [
        ...prev,
        ...files.map((file) => ({
          key: crypto.randomUUID(),
          color: colName,
          file,
          url: URL.createObjectURL(file),
        })),
      ]);
      setUpload({ color: colName, ok: `${files.length} will upload on save` });
      return;
    }

    setUpload({ color: colName, busy: true });
    const pid = productIdFor(colName);
    const { added, error } = await uploadFiles(
      pid,
      colName,
      files,
      images.filter((img) => img.product_id === pid).length,
    );
    if (added.length) {
      setImages((prev) => [...prev, ...added]);
      setPhotoVersion((v) => v + 1);
    }
    setUpload(error ? { color: colName, error } : { color: colName, ok: `${added.length} added` });
  }

  function removePending(key: string) {
    setPending((prev) => {
      const gone = prev.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.key !== key);
    });
  }

  // Save to Product Master
  function handleSave() {
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
        // Skip starter rows left empty
        lines: activeLines
          .filter((l) => l.category_name || l.item_name || num(l.rate) > 0)
          .map((l) => ({
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
        let photoMsg = "";
        let photosFailed = false;
        const ids: Record<string, string> = Object.fromEntries(
          (res.variants ?? []).map((v) => [v.color, v.id]),
        );
        setVariantIds(ids);
        if (res.productId && pending.length) {
          const added: ProductImage[] = [];
          const failed: string[] = [];
          for (const colName of new Set(pending.map((p) => p.color))) {
            const pid = ids[colName] ?? res.productId;
            const files = pending.filter((p) => p.color === colName).map((p) => p.file);
            const existing = [...images, ...added].filter((img) => img.product_id === pid).length;
            const r = await uploadFiles(pid, colName, files, existing);
            added.push(...r.added);
            if (r.error) failed.push(`${colName}: ${r.error}`);
          }
          photosFailed = failed.length > 0;
          pending.forEach((p) => URL.revokeObjectURL(p.url));
          setPending([]);
          setImages((prev) => [...prev, ...added]);
          setPhotoVersion((v) => v + 1);
          photoMsg = failed.length
            ? ` ${added.length} photo(s) uploaded; failed — ${failed.join("; ")}`
            : ` ${added.length} photo(s) uploaded.`;
        }
        const savedCodes = res.variants?.length
          ? res.variants.map((v) => v.code).join(", ")
          : (res.productCode ?? code.trim());

        // All good: start a fresh, blank calculator. The t param changes the
        // page key so it remounts even when already on /cost-calculator.
        if (!photosFailed) {
          router.push(
            `/cost-calculator?saved=${encodeURIComponent(savedCodes)}&t=${Date.now()}`,
          );
          return;
        }

        // A photo failed: stay put so the error is visible and can be retried.
        setFeedback({
          success: `Saved ${savedCodes} with CP ${formatMoney(res.totalCost)} and SP ${formatMoney(res.sellingPrice)}.${photoMsg}`,
        });
        if (res.productId) setSelectedProductId(res.productId);
      }
    });
  }

  return (
    <div className="space-y-6">
      {savedCodes && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">
          ✓ Saved <span className="font-mono">{savedCodes}</span>. Ready for the next product.
        </div>
      )}
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
                      style={{
                        backgroundColor: productColors.find((p) => p.name === c.color)?.hex,
                      }}
                    />
                    {c.code}
                  </span>
                ))}
              </div>
            ) : (
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
            )}
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

        {/* Color finishes: one row per colour with its photos */}
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-[var(--color-ink)]">
              Color Finishes &amp; Photos
            </span>
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
          {!selectedProductId && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Photos you add now upload automatically when you save the product.
            </p>
          )}

          <ul className="mt-2 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {productColors.map((col) => {
              const checked = selectedColors.includes(col.name);
              const colImages = images.filter(
                (img) => img.color === col.name || img.color_code === col.code,
              );
              const colPending = pending.filter((p) => p.color === col.name);
              const status = upload?.color === col.name ? upload : null;
              return (
                <li key={col.name} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <label className="flex min-w-[190px] cursor-pointer items-center gap-2 text-xs font-medium text-[var(--color-ink)]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleColorSelect(col.name)}
                      className="h-4 w-4 rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                    />
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border border-black/20"
                      style={{ backgroundColor: col.hex }}
                    />
                    {col.name} ({col.code})
                  </label>

                  <div className="flex flex-1 items-center gap-1.5">
                    {colImages.length === 0 && colPending.length === 0 ? (
                      <span className="text-[11px] text-[var(--color-muted)]">No photos</span>
                    ) : (
                      colImages.slice(0, 5).map((img) => (
                        <ImagePreview
                          key={img.id}
                          src={img.url}
                          alt={`${name || "Product"} — ${col.name}`}
                          sizes="40px"
                          className="h-10 w-10 rounded-md border border-slate-200 bg-slate-100"
                        />
                      ))
                    )}
                    {colPending.map((p) => (
                      <span
                        key={p.key}
                        title="Uploads when you save"
                        className="relative h-10 w-10 overflow-hidden rounded-md border border-dashed border-amber-400"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                        <img src={p.url} alt={p.file.name} className="h-full w-full object-cover opacity-80" />
                        <button
                          type="button"
                          onClick={() => removePending(p.key)}
                          title="Remove"
                          className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl bg-white/90 text-[10px] leading-none text-red-600"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    {colImages.length > 5 && (
                      <span className="text-[11px] text-[var(--color-muted)]">
                        +{colImages.length - 5}
                      </span>
                    )}
                  </div>

                  {status?.busy && (
                    <span className="text-[11px] text-[var(--color-muted)]">Uploading…</span>
                  )}
                  {status?.error && (
                    <span className="text-[11px] font-medium text-red-600">{status.error}</span>
                  )}
                  {status?.ok && (
                    <span className="text-[11px] font-medium text-emerald-700">{status.ok}</span>
                  )}

                  <label
                    title={
                      selectedProductId
                        ? `Upload ${col.name} photos`
                        : `Add ${col.name} photos; they upload when you save`
                    }
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      !upload?.busy
                        ? "cursor-pointer border-[var(--color-brand)] text-[var(--color-brand)] hover:bg-emerald-50"
                        : "cursor-not-allowed border-slate-200 text-slate-400"
                    }`}
                  >
                    📷 Upload
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      disabled={upload?.busy}
                      onChange={(e) => handleColorUpload(col.name, e.currentTarget)}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Product Photos & Color Finishes */}
      {selectedProductId ? (
        <div className="card p-5 shadow-sm">
          <ProductImagesManager
            // Remount after a colour-row upload so the gallery shows it
            key={`${selectedProductId}-${photoVersion}`}
            productId={selectedProductId}
            initialImages={images.filter((img) => img.product_id === selectedProductId)}
            onImagesChange={handleGalleryChange}
            productName={name}
            currentColor={selectedColors[0]}
            colors={
              selectedColors.length
                ? productColors.filter((c) => selectedColors.includes(c.name))
                : productColors
            }
          />
        </div>
      ) : (
        <div className="card p-4 border-dashed bg-slate-50/60 text-center text-xs text-[var(--color-muted)]">
          Save this product first to upload and manage photos for each of its color finishes.
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
                                  handleLineCategoryChange(line.tempKey, e.target.value)
                                }
                                className="select text-xs py-1 px-2"
                              >
                                <option value="">Select category…</option>
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
                                  handleLineSubcategoryChange(line.tempKey, e.target.value)
                                }
                                className="select text-xs py-1 px-2 font-medium"
                                disabled={!line.category_name}
                              >
                                <option value="">Select…</option>
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
                                disabled={!line.subcategory_name}
                              >
                                <option value="">Select…</option>
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
                (Finished items purchased in — Cost Price = Rate × Qty)
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
                  <th className="p-2 min-w-[110px] text-right">Cost Price</th>
                  <th className="p-2 min-w-[70px] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {boughtOutLines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
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
              Selling Price = CP &divide; (1 &minus; Markup%)
            </p>
            {num(markupPct) >= 100 && (
              <p className="mt-1 text-[11px] font-semibold text-red-600">
                Markup must be under 100% — at 100% the formula has no finite price.
              </p>
            )}
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
              onClick={handleSave}
              disabled={isPending}
              className="btn-primary px-5 py-2.5 text-sm font-bold shadow"
            >
              {isPending ? "Saving Costing…" : `Save Product (${code || "Primary"})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
