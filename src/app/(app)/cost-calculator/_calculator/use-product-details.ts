import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  colorCode,
  deriveCategoryCode,
  formatProductCode,
  getNextSerialForCategory,
  parseProductCode,
} from "@/lib/product-code";
import type { Category, CostStageWithHierarchy, Product, ProductCostSheet } from "@/lib/types";
import { getNextSerialAction } from "../actions";
import { costingHref } from "../href";
import { matchOrigin } from "./lines";

export type ProductDetails = ReturnType<typeof useProductDetails>;

/** Code, name, category, origin, colours and the other product-level fields. */
export function useProductDetails({
  stages,
  categories,
  products,
  initialProduct,
  initialSheet,
}: {
  stages: CostStageWithHierarchy[];
  categories: Category[];
  products: Product[];
  initialProduct?: Product | null;
  initialSheet?: ProductCostSheet | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedProductId, setSelectedProductId] = useState(initialProduct?.id ?? "");
  const [code, setCode] = useState(initialProduct?.code ?? initialSheet?.product_code ?? "");
  const [name, setName] = useState(initialProduct?.name ?? initialSheet?.product_name ?? "");
  const [categoryId, setCategoryId] = useState(initialProduct?.category_id ?? "");
  const [source, setSource] = useState<string>(() => matchOrigin(initialProduct?.source ?? "In-house"));
  // Stage codes whose line table is hidden. Outsource collapses everything.
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(() =>
    (initialProduct?.source ?? "").toLowerCase() === "outsource"
      ? new Set(stages.map((s) => s.code))
      : new Set(),
  );
  const [selectedColors, setSelectedColors] = useState<string[]>(initialProduct?.colors ?? ["Walnut"]);
  const [isActive, setIsActive] = useState(initialProduct ? initialProduct.is_active : true);
  const [notes, setNotes] = useState(initialSheet?.notes ?? "");
  const parsedCode = parseProductCode(code);

  // Each product's costing is its own page; a blank one is /cost-calculator.
  function selectProduct(prodId: string) {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    router.push(prod ? costingHref(prod.code) : "/cost-calculator");
  }

  // Product Origin decides whether the stages start collapsed.
  function changeOrigin(origin: string) {
    setSource(origin);
    setCollapsedStages(origin === "Outsource" ? new Set(stages.map((s) => s.code)) : new Set());
  }

  function toggleStage(stageCode: string) {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (!next.delete(stageCode)) next.add(stageCode);
      return next;
    });
  }

  const categoryCode = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat?.code || (cat ? deriveCategoryCode(cat.name) : "LC");
  };

  function changeCategory(newCatId: string) {
    setCategoryId(newCatId);
    const catCode = categoryCode(newCatId);
    const colCode = parsedCode.colorCode || "WL";
    let serial = parsedCode.serial || "0001";
    if (!selectedProductId) {
      // Guess from the loaded list at once, then confirm with the server.
      serial = getNextSerialForCategory(catCode, products.map((p) => p.code));
      startTransition(async () => {
        const res = await getNextSerialAction(catCode);
        if (res.serial) setCode(formatProductCode(catCode, res.serial, colCode));
      });
    }
    setCode(formatProductCode(catCode, serial, colCode));
  }

  async function autoGenerateCode() {
    const catCode = categoryCode(categoryId);
    const res = await getNextSerialAction(catCode);
    setCode(formatProductCode(catCode, res.serial || "0001", selectedColors[0] || "Walnut"));
  }

  // A product can come in several finishes; the code suffix follows the first.
  function toggleColor(colName: string) {
    const next = selectedColors.includes(colName)
      ? selectedColors.filter((c) => c !== colName)
      : [...selectedColors, colName];
    setSelectedColors(next);
    if (!next[0]) return;
    const cat = categories.find((c) => c.id === categoryId);
    const catCode = cat?.code || parsedCode.categoryCode || "LC";
    setCode(formatProductCode(catCode, parsedCode.serial || "0001", colorCode(next[0])));
  }

  return {
    selectedProductId, setSelectedProductId, code, setCode, name, setName, categoryId, source,
    collapsedStages, selectedColors, isActive, setIsActive, notes, setNotes, parsedCode,
    selectProduct, changeOrigin, toggleStage, changeCategory, autoGenerateCode, toggleColor,
  };
}
