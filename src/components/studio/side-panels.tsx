"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ImagePlus, Loader2, Package, Palette, Search, Shapes, Slash, Spline, Trash2, Type, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CANVAS_PRESETS } from "@/lib/hamper-canvas";
import { DRAG_MIME, SHAPES, TEXT_COMBOS, TEXT_PRESETS, makeText, type Editor, type PickerProduct } from "./editor";
import { ColorPanel, cx, fieldCls, panelTitle, toolBtn } from "./studio-ui";

export type SideTab = "products" | "uploads" | "text" | "elements" | "background";

const RAIL: { id: SideTab; label: string; Icon: typeof Package }[] = [
  { id: "products", label: "Products", Icon: Package },
  { id: "uploads", label: "Uploads", Icon: Upload },
  { id: "text", label: "Text", Icon: Type },
  { id: "elements", label: "Elements", Icon: Shapes },
  { id: "background", label: "Background", Icon: Palette },
];

export function Rail({ tab, onTab }: { tab: SideTab | null; onTab: (t: SideTab | null) => void }) {
  return (
    <nav className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-[var(--st-line)] bg-[var(--st-panel)] py-2">
      {RAIL.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onTab(tab === id ? null : id)}
          className={cx(
            "flex w-[62px] flex-col items-center gap-1 rounded-lg py-2 text-[10.5px] transition-colors",
            tab === id ? "bg-[var(--st-panel-2)] text-[var(--st-text)]" : "text-[var(--st-muted)] hover:text-[var(--st-text)]",
          )}
        >
          <Icon className={cx("h-5 w-5", tab === id && "text-[var(--st-accent)]")} strokeWidth={1.8} />
          {label}
        </button>
      ))}
    </nav>
  );
}

export function SidePanel({
  tab,
  onClose,
  ed,
  products,
  hamperProductIds,
}: {
  tab: SideTab;
  onClose: () => void;
  ed: Editor;
  products: PickerProduct[];
  hamperProductIds: string[];
}) {
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-[var(--st-line)] bg-[var(--st-panel)]">
      <div className="flex h-11 items-center justify-between px-4">
        <span className="text-[14px] font-semibold">{RAIL.find((r) => r.id === tab)?.label}</span>
        <button type="button" onClick={onClose} className={toolBtn} aria-label="Close panel" title="Close panel">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {tab === "products" && <ProductsPanel ed={ed} products={products} hamperProductIds={hamperProductIds} />}
        {tab === "uploads" && <UploadsPanel ed={ed} />}
        {tab === "text" && <TextPanel ed={ed} />}
        {tab === "elements" && <ElementsPanel ed={ed} />}
        {tab === "background" && <BackgroundPanel ed={ed} />}
      </div>
    </aside>
  );
}

function setDragImage(e: React.DragEvent, product: PickerProduct, url: string) {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ product, url }));
  e.dataTransfer.effectAllowed = "copy";
}

function ProductsPanel({
  ed,
  products,
  hamperProductIds,
}: {
  ed: Editor;
  products: PickerProduct[];
  hamperProductIds: string[];
}) {
  const [scope, setScope] = useState<"hamper" | "all">(hamperProductIds.length ? "hamper" : "all");
  const [q, setQ] = useState("");
  const [product, setProduct] = useState<PickerProduct | null>(null);
  const [images, setImages] = useState<string[] | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const inHamper = new Set(hamperProductIds);
    return products
      .filter((p) => scope === "all" || inHamper.has(p.id))
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s))
      .slice(0, 120);
  }, [q, scope, products, hamperProductIds]);

  async function open(p: PickerProduct) {
    setProduct(p);
    setImages(null);
    const { data } = await createClient()
      .from("product_images")
      .select("url")
      .eq("product_id", p.id)
      .order("is_primary", { ascending: false })
      .order("sort_order")
      .returns<{ url: string }[]>();
    const urls = (data ?? []).map((r) => r.url);
    setImages(urls.length ? urls : p.image_url ? [p.image_url] : []);
  }

  return (
    <div className="space-y-3">
      {ed.swapId && (
        <div className="flex items-center justify-between rounded-md bg-[var(--st-accent-soft)] px-3 py-2 text-[12px]">
          Pick an image to replace the selected one
          <button type="button" className="underline" onClick={() => ed.startSwap(null)}>
            Cancel
          </button>
        </div>
      )}

      {product ? (
        <>
          <button type="button" className={cx(toolBtn, "-ml-2")} onClick={() => setProduct(null)}>
            <ArrowLeft className="h-4 w-4" /> {product.name}
          </button>
          {images === null ? (
            <p className="text-[var(--st-muted)]">Loading images…</p>
          ) : images.length === 0 ? (
            <p className="text-[var(--st-muted)]">No images yet. Add some on the product page.</p>
          ) : (
            <>
              <p className="text-[12px] text-[var(--st-muted)]">Click to add, or drag onto the page.</p>
              <div className="grid grid-cols-2 gap-2">
                {images.map((url) => (
                  <button
                    key={url}
                    type="button"
                    draggable
                    onDragStart={(e) => setDragImage(e, product, url)}
                    onClick={() => ed.placeImage(product, url)}
                    className="checkerboard aspect-square overflow-hidden rounded-md border border-[var(--st-line)] hover:border-[var(--st-accent)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-contain" draggable={false} />
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-[var(--st-muted)]" />
            <input
              className={cx(fieldCls, "w-full pl-8")}
              placeholder="Search products"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            {(
              [
                ["hamper", `In this hamper (${hamperProductIds.length})`],
                ["all", "All products"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setScope(id)}
                className={cx(
                  "rounded-full border px-3 py-1 text-[12px]",
                  scope === id
                    ? "border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent-strong)]"
                    : "border-[var(--st-line)] text-[var(--st-muted)] hover:text-[var(--st-text)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="text-[var(--st-muted)]">No products found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  draggable={!!p.image_url}
                  onDragStart={(e) => p.image_url && setDragImage(e, p, p.image_url)}
                  onClick={() => open(p)}
                  className="group text-left"
                  title={`${p.name} (${p.code})`}
                >
                  <div className="checkerboard aspect-square overflow-hidden rounded-md border border-[var(--st-line)] group-hover:border-[var(--st-accent)]">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-full w-full object-contain" draggable={false} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[var(--st-muted)]">
                        <Package className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[12px] leading-tight">{p.name}</div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UploadsPanel({ ed }: { ed: Editor }) {
  return (
    <div className="space-y-3">
      <label
        className={cx(
          "flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[var(--st-accent)] px-3 py-2.5 text-[13px] font-medium text-[var(--st-on-accent)] hover:bg-[var(--st-accent-strong)]",
          ed.uploading && "pointer-events-none opacity-60",
        )}
      >
        {ed.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {ed.uploading ? "Uploading…" : "Upload images"}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            ed.uploadImages(files);
          }}
        />
      </label>
      <p className="text-[12px] text-[var(--st-muted)]">
        Pick several at once (hold Ctrl or Shift in the file dialog). Each image is added to the page as its own layer.
      </p>

      {ed.uploads.length > 0 && (
        <>
          <div className={panelTitle}>Uploaded this session</div>
          <div className="grid grid-cols-2 gap-2">
            {ed.uploads.map((u) => (
              <button
                key={u.url}
                type="button"
                title={`Add ${u.name} again`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ product: null, url: u.url, name: u.name }));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => ed.addImage(u.url, u.name)}
                className="checkerboard aspect-square overflow-hidden rounded-md border border-[var(--st-line)] hover:border-[var(--st-accent)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.url} alt="" className="h-full w-full object-contain" draggable={false} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TextPanel({ ed }: { ed: Editor }) {
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[var(--st-muted)]">Click text to add it to the page. Double-click it on the page to type.</p>
      <div className="space-y-2">
        {TEXT_PRESETS.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => ed.add(makeText(ed.canvas, t.text, t.style))}
            className="block w-full rounded-md border border-[var(--st-line)] bg-[var(--st-panel-2)] px-3 py-2.5 text-left hover:border-[var(--st-accent)]"
            style={{ fontFamily: t.style.fontFamily, fontSize: t.preview, fontWeight: t.style.fontStyle.includes("bold") ? 700 : 400 }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>
        <div className={cx(panelTitle, "mb-2")}>Font combinations</div>
        <div className="grid grid-cols-2 gap-2">
          {TEXT_COMBOS.map((t) => (
            <button
              key={t.text}
              type="button"
              onClick={() => ed.add(makeText(ed.canvas, t.text, t.style))}
              className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-[var(--st-line)] bg-white p-2 text-center leading-tight hover:ring-2 hover:ring-[var(--st-accent)]"
              style={{
                fontFamily: t.style.fontFamily,
                color: t.style.color,
                fontSize: Math.min(26, t.style.fontSize / 4),
                fontWeight: t.style.fontStyle.includes("bold") ? 700 : 400,
                fontStyle: t.style.fontStyle.includes("italic") ? "italic" : "normal",
                letterSpacing: (t.style.letterSpacing ?? 0) / 4,
              }}
            >
              {t.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ElementsPanel({ ed }: { ed: Editor }) {
  return (
    <div className="space-y-4">
      <div>
        <div className={cx(panelTitle, "mb-2")}>Brand</div>
        <button
          type="button"
          title="Add the Lattice Lane logo"
          onClick={ed.addLogo}
          className="flex w-full items-center justify-center rounded-md border border-[var(--st-line)] bg-white p-3 hover:border-[var(--st-accent)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/deck-logo.png" alt="Lattice Lane logo" className="h-16 w-auto" />
        </button>
      </div>
      <div>
        <div className={cx(panelTitle, "mb-2")}>Draw (MS Paint style)</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            title="Draw straight line by dragging on canvas"
            onClick={() => ed.setActiveTool(ed.activeTool === "line" ? "select" : "line")}
            className={cx(
              "flex items-center gap-2 rounded-md border p-2.5 text-[12px] font-medium transition-colors",
              ed.activeTool === "line"
                ? "border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent-strong)]"
                : "border-[var(--st-line)] bg-[var(--st-panel-2)] hover:bg-[var(--st-hover)]",
            )}
          >
            <Slash className="h-4 w-4 shrink-0 rotate-45" />
            <span>Draw Line</span>
          </button>
          <button
            type="button"
            title="Draw curved line by dragging on canvas"
            onClick={() => ed.setActiveTool(ed.activeTool === "curve" ? "select" : "curve")}
            className={cx(
              "flex items-center gap-2 rounded-md border p-2.5 text-[12px] font-medium transition-colors",
              ed.activeTool === "curve"
                ? "border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent-strong)]"
                : "border-[var(--st-line)] bg-[var(--st-panel-2)] hover:bg-[var(--st-hover)]",
            )}
          >
            <Spline className="h-4 w-4 shrink-0" />
            <span>Draw Curve</span>
          </button>
        </div>
      </div>
      <div>
        <div className={cx(panelTitle, "mb-2")}>Shapes</div>
        <div className="grid grid-cols-3 gap-2">
          {SHAPES.map((s) => (
            <button
              key={s.label}
              type="button"
              title={s.label}
              onClick={() => ed.add(s.make(ed.canvas))}
              className="flex aspect-square items-center justify-center rounded-md bg-[var(--st-panel-2)] p-3 hover:bg-[var(--st-hover)]"
            >
              <svg viewBox="0 0 48 48" className="h-full w-full fill-[#c8a97e] stroke-[#c8a97e]" dangerouslySetInnerHTML={{ __html: s.svg }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BackgroundPanel({ ed }: { ed: Editor }) {
  const bg = ed.canvas.background;
  return (
    <div className="space-y-5">
      <ColorPanel
        fill={bg.fill}
        documentColors={ed.documentColors}
        onChange={(fill) => ed.change((c) => ({ ...c, background: { ...c.background, fill } }), "bg-fill")}
      />

      <div>
        <div className={cx(panelTitle, "mb-2")}>Background image</div>
        {bg.image_url && (
          <div className="checkerboard mb-2 aspect-video overflow-hidden rounded-md border border-[var(--st-line)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bg.image_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex gap-2">
          <label className={cx(toolBtn, "flex-1 cursor-pointer border border-[var(--st-line)]")}>
            <ImagePlus className="h-4 w-4" />
            {bg.image_url ? "Replace" : "Upload image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) ed.uploadBackground(f);
                e.target.value = "";
              }}
            />
          </label>
          {bg.image_url && (
            <button
              type="button"
              title="Remove background image"
              className={cx(toolBtn, "border border-[var(--st-line)]")}
              onClick={() => ed.change((c) => ({ ...c, background: { ...c.background, image_url: null } }))}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--st-muted)]">Fills the page, e.g. an empty basket or box.</p>
      </div>

      <div>
        <div className={cx(panelTitle, "mb-2")}>Page size</div>
        <div className="space-y-1">
          {CANVAS_PRESETS.map((p) => {
            const on = p.width === ed.canvas.width && p.height === ed.canvas.height;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => ed.change((c) => ({ ...c, width: p.width, height: p.height }))}
                className={cx(
                  "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-[var(--st-hover)]",
                  on && "bg-[var(--st-accent-soft)]",
                )}
              >
                <span className="flex h-7 w-7 items-center justify-center">
                  <span
                    className="border border-[var(--st-muted)]"
                    style={{ width: (p.width / Math.max(p.width, p.height)) * 24, height: (p.height / Math.max(p.width, p.height)) * 24 }}
                  />
                </span>
                <span className="flex-1">{p.label}</span>
                <span className="text-[11px] tabular-nums text-[var(--st-muted)]">
                  {p.width}×{p.height}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
