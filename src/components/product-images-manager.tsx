"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import {
  uploadProductImage,
  addExternalProductImage,
  setPrimaryProductImage,
  updateProductImageColor,
  deleteProductImage,
} from "@/app/(app)/products/image-actions";
import { STANDARD_PRODUCT_COLORS } from "@/lib/product-code";
import type { ProductImage } from "@/lib/types";

export function ProductImagesManager({
  productId,
  initialImages = [],
  productName,
  currentColor,
}: {
  productId?: string | null;
  initialImages?: ProductImage[];
  productName?: string;
  currentColor?: string | null;
}) {
  const [images, setImages] = useState<ProductImage[]>(initialImages);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [uploadColor, setUploadColor] = useState<string>(currentColor || "Walnut");
  const [isPrimaryUpload, setIsPrimaryUpload] = useState<boolean>(images.length === 0);
  const [urlInput, setUrlInput] = useState<string>("");
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!productId) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h4 className="mt-2 text-sm font-semibold text-[var(--color-ink)]">
          Photos & Color Finishes
        </h4>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Save this product first to upload high-resolution photos for Walnut, Natural, and Black finishes.
        </p>
      </div>
    );
  }

  // Filtered images based on active tab
  const filteredImages = images.filter((img) => {
    if (activeTab === "all") return true;
    if (activeTab === "general") return !img.color && !img.color_code;
    return (
      img.color?.toLowerCase() === activeTab.toLowerCase() ||
      img.color_code?.toLowerCase() === activeTab.toLowerCase()
    );
  });

  // Handle file uploads
  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0 || !productId) return;
    setFeedback({});

    startTransition(async () => {
      const newImgs = [...images];
      let hasError = false;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("productId", productId);
        formData.append("color", uploadColor === "General" ? "" : uploadColor);
        formData.append("isPrimary", String(isPrimaryUpload && i === 0));

        const res = await uploadProductImage(formData);
        if (res.error) {
          setFeedback({ error: res.error });
          hasError = true;
          break;
        } else if (res.image) {
          if (res.image.is_primary) {
            newImgs.forEach((img) => (img.is_primary = false));
          }
          newImgs.push(res.image);
        }
      }

      setImages(newImgs);
      if (!hasError) {
        setFeedback({ success: "Image(s) uploaded successfully!" });
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  }

  // Handle URL addition
  async function handleAddUrl() {
    if (!urlInput.trim() || !productId) return;
    setFeedback({});

    startTransition(async () => {
      const res = await addExternalProductImage(
        productId,
        urlInput.trim(),
        uploadColor === "General" ? null : uploadColor,
        isPrimaryUpload,
      );

      if (res.error) {
        setFeedback({ error: res.error });
      } else if (res.image) {
        const newImgs = res.image.is_primary
          ? images.map((img) => ({ ...img, is_primary: false })).concat(res.image)
          : [...images, res.image];
        setImages(newImgs);
        setUrlInput("");
        setShowUrlInput(false);
        setFeedback({ success: "Image URL added successfully!" });
      }
    });
  }

  // Set primary
  function handleSetPrimary(imageId: string) {
    if (!productId) return;
    startTransition(async () => {
      const res = await setPrimaryProductImage(imageId, productId);
      if (res.error) {
        setFeedback({ error: res.error });
      } else {
        setImages((prev) =>
          prev.map((img) => ({ ...img, is_primary: img.id === imageId })),
        );
        setFeedback({ success: "Primary cover image updated." });
      }
    });
  }

  // Change color
  function handleChangeColor(imageId: string, newColor: string) {
    startTransition(async () => {
      const colorVal = newColor === "General" ? null : newColor;
      const res = await updateProductImageColor(imageId, colorVal);
      if (res.error) {
        setFeedback({ error: res.error });
      } else if (res.image) {
        setImages((prev) =>
          prev.map((img) => (img.id === imageId ? res.image! : img)),
        );
      }
    });
  }

  // Delete image
  function handleDelete(imageId: string) {
    if (!productId || !confirm("Are you sure you want to delete this image?")) return;
    startTransition(async () => {
      const res = await deleteProductImage(imageId, productId);
      if (res.error) {
        setFeedback({ error: res.error });
      } else {
        setImages((prev) => prev.filter((img) => img.id !== imageId));
        setFeedback({ success: "Image deleted successfully." });
      }
    });
  }

  // Count per color
  const countAll = images.length;
  const countWalnut = images.filter((i) => i.color === "Walnut" || i.color_code === "WL").length;
  const countNatural = images.filter((i) => i.color === "Natural" || i.color_code === "NT").length;
  const countBlack = images.filter((i) => i.color === "Black" || i.color_code === "BL").length;
  const countGeneral = images.filter((i) => !i.color && !i.color_code).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-ink)]">
            Product Images & Color Variations
          </h3>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            Upload photos for each color finish (Walnut, Natural, Black). Multiple images supported per product.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-xs text-[var(--color-brand)] hover:underline font-medium"
          >
            {showUrlInput ? "Hide URL Option" : "+ Add via URL"}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
            activeTab === "all"
              ? "bg-[var(--color-brand)] text-white shadow-xs"
              : "text-[var(--color-muted)] hover:bg-slate-100"
          }`}
        >
          All Photos ({countAll})
        </button>

        {STANDARD_PRODUCT_COLORS.map((col) => {
          const count =
            col.code === "WL" ? countWalnut : col.code === "NT" ? countNatural : countBlack;
          const isActive = activeTab.toLowerCase() === col.name.toLowerCase();
          return (
            <button
              key={col.code}
              type="button"
              onClick={() => setActiveTab(col.name)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-[var(--color-brand)] text-white shadow-xs"
                  : "text-[var(--color-muted)] hover:bg-slate-100"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full border border-black/20"
                style={{ backgroundColor: col.hex }}
              />
              {col.name} ({count})
            </button>
          );
        })}

        {countGeneral > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "general"
                ? "bg-[var(--color-brand)] text-white shadow-xs"
                : "text-[var(--color-muted)] hover:bg-slate-100"
            }`}
          >
            General ({countGeneral})
          </button>
        )}
      </div>

      {/* Upload Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-700">Tag Finish:</label>
          <select
            value={uploadColor}
            onChange={(e) => setUploadColor(e.target.value)}
            className="select text-xs py-1 px-2.5 bg-white min-w-[130px]"
          >
            {STANDARD_PRODUCT_COLORS.map((c) => (
              <option key={c.code} value={c.name}>
                {c.name} ({c.code})
              </option>
            ))}
            <option value="General">All Colors / General</option>
          </select>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={isPrimaryUpload}
            onChange={(e) => setIsPrimaryUpload(e.target.checked)}
            className="rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
          />
          Set as Primary Cover
        </label>

        <div className="ml-auto flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
            id="product-photo-upload"
          />
          <label
            htmlFor="product-photo-upload"
            className={`btn-primary text-xs py-1.5 px-3.5 cursor-pointer ${
              isPending ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {isPending ? "Uploading…" : "+ Upload Photos"}
          </label>
        </div>
      </div>

      {/* External URL Input Option */}
      {showUrlInput && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 bg-white">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste public image URL (https://...)"
            className="input text-xs flex-1 py-1.5"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddUrl();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddUrl}
            disabled={isPending || !urlInput.trim()}
            className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap"
          >
            Add URL
          </button>
        </div>
      )}

      {/* Feedback Alerts */}
      {feedback.error && (
        <div className="rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700 border border-red-200">
          {feedback.error}
        </div>
      )}
      {feedback.success && (
        <div className="rounded-lg bg-emerald-50 p-2.5 text-xs font-medium text-emerald-800 border border-emerald-200">
          {feedback.success}
        </div>
      )}

      {/* Image Cards Grid */}
      {filteredImages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-[var(--color-muted)]">
          No images uploaded for {activeTab === "all" ? "this product" : `${activeTab} finish`} yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {filteredImages.map((img) => {
            const colorObj = STANDARD_PRODUCT_COLORS.find(
              (c) => c.name === img.color || c.code === img.color_code,
            );

            return (
              <div
                key={img.id}
                className={`group relative overflow-hidden rounded-xl border bg-white shadow-xs transition-all ${
                  img.is_primary
                    ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Image Container */}
                <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                  <Image
                    src={img.url}
                    alt={img.caption || productName || "Product Photo"}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                    unoptimized
                  />

                  {/* Primary Badge */}
                  {img.is_primary && (
                    <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-emerald-700/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-xs">
                      ★ Primary
                    </span>
                  )}

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDelete(img.id)}
                    className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete photo"
                  >
                    &times;
                  </button>
                </div>

                {/* Footer Controls */}
                <div className="p-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    {/* Color Finish Tag */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: colorObj?.hex || "#94a3b8" }}
                      />
                      <select
                        value={img.color || "General"}
                        onChange={(e) => handleChangeColor(img.id, e.target.value)}
                        className="text-[11px] font-medium text-slate-700 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer truncate"
                      >
                        {STANDARD_PRODUCT_COLORS.map((c) => (
                          <option key={c.code} value={c.name}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                        <option value="General">General / All</option>
                      </select>
                    </div>

                    {/* Set Primary Button */}
                    {!img.is_primary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(img.id)}
                        className="text-[10px] font-medium text-slate-400 hover:text-[var(--color-brand)] transition-colors"
                        title="Set as primary cover photo"
                      >
                        Make Primary
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
