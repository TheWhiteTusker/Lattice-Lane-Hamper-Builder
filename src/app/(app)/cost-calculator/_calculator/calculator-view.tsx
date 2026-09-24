"use client";

import { useMemo } from "react";
import type { ProductColor } from "@/lib/product-code";
import { ProductImagesManager } from "@/components/product-images-manager";
import type {
  Category,
  CostStageWithHierarchy,
  Product,
  ProductCostLine,
  ProductCostSheet,
  ProductImage,
} from "@/lib/types";
import { BoughtOutSection } from "./bought-out-section";
import { CostSummary } from "./cost-summary";
import { BOUGHT_OUT } from "./lines";
import { ProductDetailsCard } from "./product-details-card";
import { StageSection } from "./stage-section";
import { useCostLines } from "./use-cost-lines";
import { usePricing } from "./use-pricing";
import { useProductDetails } from "./use-product-details";
import { useProductPhotos } from "./use-product-photos";
import { useSaveCosting } from "./use-save-costing";

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
  initialSheet?: (ProductCostSheet & { lines?: ProductCostLine[] }) | null;
  initialImages?: ProductImage[];
  /** Codes from the save that reset this page, shown as a banner. */
  savedCodes?: string;
}) {
  const details = useProductDetails({ stages, categories, products, initialProduct, initialSheet });
  const photos = useProductPhotos(initialImages, details.selectedProductId);
  const api = useCostLines(stages, initialSheet?.lines);

  // Bought-out lines only count while the origin isn't In-house, so switching
  // origin does not silently keep charging for them.
  const { source } = details;
  const activeLines = useMemo(
    () => (source !== "In-house" ? api.lines : api.lines.filter((l) => l.stage_code !== BOUGHT_OUT)),
    [api.lines, source],
  );
  const pricing = usePricing(activeLines, initialProduct, initialSheet);
  const { save, isPending, feedback } = useSaveCosting({ details, pricing, photos, activeLines, initialSheet });
  const { selectedProductId, selectedColors } = details;

  return (
    <div className="space-y-6">
      {savedCodes && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">
          ✓ Saved <span className="font-mono">{savedCodes}</span>. Ready for the next product.
        </div>
      )}

      <ProductDetailsCard
        details={details}
        photos={photos}
        products={products}
        categories={categories}
        productColors={productColors}
        imageUrl={initialProduct?.image_url}
      />

      {selectedProductId ? (
        <div className="card p-5 shadow-sm">
          <ProductImagesManager
            // Remount after a colour-row upload so the gallery shows it
            key={`${selectedProductId}-${photos.photoVersion}`}
            productId={selectedProductId}
            // Every colour's photos, including those saved on sibling colour products
            initialImages={photos.images}
            onImagesChange={photos.handleGalleryChange}
            productName={details.name}
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

      {stages.map((stage) => (
        <StageSection
          key={stage.id}
          stage={stage}
          api={api}
          collapsed={details.collapsedStages.has(stage.code)}
          onToggle={() => details.toggleStage(stage.code)}
          overhead={pricing.overheadFor(stage.code)}
          onOverhead={(pct) => pricing.setOverhead(stage.code, pct)}
        />
      ))}

      {source !== "In-house" && <BoughtOutSection api={api} />}

      <CostSummary
        details={details}
        pricing={pricing}
        feedback={feedback}
        isPending={isPending}
        onSave={save}
      />
    </div>
  );
}
