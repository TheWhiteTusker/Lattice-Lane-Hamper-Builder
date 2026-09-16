"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type Konva from "konva";
import {
  Ellipse,
  Group,
  Image as KImage,
  Layer as KLayer,
  Line,
  Rect,
  RegularPolygon,
  Stage,
  Star,
  Text,
  Transformer,
} from "react-konva";
import {
  ArrowLeft,
  Check,
  Download,
  Keyboard,
  Loader2,
  Minus,
  Plus,
  Redo2,
  Scaling,
  Undo2,
} from "lucide-react";
import {
  CANVAS_PRESETS,
  alignBoxes,
  alignToPage,
  boundsOf,
  distributeBoxes,
  fillProps,
  fitScale,
  intersects,
  moveLayers,
  record,
  redo,
  reorderLayer,
  snap,
  startHistory,
  undo,
  type Box,
  type HamperCanvas,
  type Layer,
} from "@/lib/hamper-canvas";
import { removeBackground } from "@/lib/background-removal";
import { uploadProductImage } from "@/app/(app)/products/image-actions";
import { saveHamperCanvas, uploadHamperBackground } from "./actions";
import { DRAG_MIME, baseLayer, type Editor, type PickerProduct } from "./editor";
import { ContextToolbar } from "./context-toolbar";
import { LayersPanel, TransformPanel } from "./layers-panel";
import { Rail, SidePanel, type SideTab } from "./side-panels";
import { FONTS_HREF, Popover, ToolButton, accentBtn, cx, panelTitle, toolBtn } from "./studio-ui";

const ACCENT = "#8b5cf6";
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 4;

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    // Without this the page becomes "tainted" and the PNG export throws.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });

function useImage(url: string | null) {
  const [img, setImg] = useState<{ url: string; el: HTMLImageElement } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    loadImage(url).then((el) => live && setImg({ url, el }), () => {});
    return () => {
      live = false;
    };
  }, [url]);
  return url && img?.url === url ? img.el : undefined;
}

const SHORTCUTS: [string, string][] = [
  ["Undo / Redo", "Ctrl+Z / Ctrl+Shift+Z"],
  ["Save", "Ctrl+S"],
  ["Select several", "Shift+click, or drag a box"],
  ["Select all", "Ctrl+A"],
  ["Copy / Paste / Duplicate", "Ctrl+C / Ctrl+V / Ctrl+D"],
  ["Delete", "Del"],
  ["Nudge (×10 with Shift)", "Arrow keys"],
  ["Forward / Backward", "Ctrl+] / Ctrl+["],
  ["To front / To back", "Ctrl+Shift+] / Ctrl+Shift+["],
  ["Edit text", "Enter or double-click"],
  ["Zoom in / out / fit", "Ctrl+= / Ctrl+- / Ctrl+0"],
  ["Zoom at cursor", "Ctrl+scroll"],
  ["Pan", "Scroll, or hold Space and drag"],
  ["Place freely (no snapping)", "Hold Alt while dragging"],
];

export default function CanvasStage({
  hamperId,
  hamperName,
  hamperCode,
  initial,
  products,
  hamperProductIds,
}: {
  hamperId: string;
  hamperName: string;
  hamperCode: string;
  initial: HamperCanvas;
  products: PickerProduct[];
  hamperProductIds: string[];
}) {
  /* ------------------------------------------------------------- document */
  const [hist, setHist] = useState(() => startHistory(initial));
  const canvas = hist.present;
  const W = canvas.width;
  const H = canvas.height;
  const [savedCanvas, setSavedCanvas] = useState(initial);
  const dirty = canvas !== savedCanvas;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [swapId, setSwapId] = useState<string | null>(null);
  const [tab, setTab] = useState<SideTab | null>("products");
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [guides, setGuides] = useState<{ vertical: number[]; horizontal: number[] } | null>(null);
  const [hover, setHover] = useState<Box | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [fontTick, setFontTick] = useState(0);
  const [clipboard, setClipboard] = useState<Layer[]>([]);

  const stageRef = useRef<Konva.Stage>(null);
  const pageRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const nodes = useRef(new Map<string, Konva.Node>());
  /** The layer the pointer is dragging; the rest of the selection follows it. */
  const dragLead = useRef<string | null>(null);

  // In z-order, so copy/paste and arrange keep the stacking.
  const selection = canvas.layers.filter((l) => selectedIds.includes(l.id));
  const selected = selection.length === 1 ? selection[0] : null;
  const editing = canvas.layers.find((l) => l.id === editingId && l.kind === "text") as
    | Extract<Layer, { kind: "text" }>
    | undefined;

  /* ----------------------------------------------------------------- view */
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<{ zoom: number | null; panX: number; panY: number }>({ zoom: null, panX: 0, panY: 0 });
  const [spaceDown, setSpaceDown] = useState(false);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoard({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = board.w ? Math.max(ZOOM_MIN, Math.min((board.w - 96) / W, (board.h - 96) / H)) : 0.3;
  const zoom = view.zoom ?? fit;
  const ox = (board.w - W * zoom) / 2 + view.panX;
  const oy = (board.h - H * zoom) / 2 + view.panY;

  /** Zoom keeping the page point under `anchor` (board coords) still. */
  const zoomTo = (next: (z: number) => number, anchor?: { x: number; y: number }) =>
    setView((v) => {
      const z = v.zoom ?? fit;
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next(z)));
      const ax = anchor?.x ?? board.w / 2;
      const ay = anchor?.y ?? board.h / 2;
      const px = (ax - ((board.w - W * z) / 2 + v.panX)) / z;
      const py = (ay - ((board.h - H * z) / 2 + v.panY)) / z;
      return {
        zoom: nz,
        panX: ax - px * nz - (board.w - W * nz) / 2,
        panY: ay - py * nz - (board.h - H * nz) / 2,
      };
    });
  const zoomFit = () => setView({ zoom: null, panX: 0, panY: 0 });

  // Wheel: pan, or zoom at the cursor with Ctrl. Needs a non-passive listener.
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        zoomTo((z) => z * Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top });
      } else {
        setView((v) => ({ zoom: v.zoom ?? fit, panX: v.panX - e.deltaX, panY: v.panY - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  /* ---------------------------------------------------------------- fonts */
  useEffect(() => {
    if (!document.querySelector(`link[data-studio-fonts]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONTS_HREF;
      link.dataset.studioFonts = "";
      document.head.appendChild(link);
    }
    const bump = () => setFontTick((t) => t + 1);
    document.fonts.addEventListener("loadingdone", bump);
    return () => document.fonts.removeEventListener("loadingdone", bump);
  }, []);

  // Canvas text doesn't trigger web-font downloads by itself, so ask for each face in use.
  const faces = [...new Set(canvas.layers.flatMap((l) => (l.kind === "text" ? [`${l.fontStyle} 40px "${l.fontFamily}"`] : [])))].join("|");
  useEffect(() => {
    if (!faces) return;
    Promise.all(faces.split("|").map((f) => document.fonts.load(f).catch(() => []))).then(() => setFontTick((t) => t + 1));
  }, [faces]);

  /* ----------------------------------------------------------- edit model */
  const change = (fn: (c: HamperCanvas) => HamperCanvas, group: string | null = null) =>
    setHist((h) => record(h, fn(h.present), group, Date.now()));
  const setLayers = (fn: (layers: Layer[]) => Layer[], group: string | null = null) =>
    change((c) => ({ ...c, layers: fn(c.layers) }), group);
  const patch = (id: string, p: Partial<Layer>, group: string | null = null) =>
    setLayers((ls) => ls.map((l) => (l.id === id ? ({ ...l, ...p } as Layer) : l)), group);
  const tweak = (id: string, p: Partial<Layer>) => patch(id, p, `${id}:${Object.keys(p).join()}`);

  const selectMany = (ids: string[]) => {
    setSelectedIds(ids);
    setMenu(null);
    if (ids.length !== 1 || ids[0] !== editingId) setEditingId(null);
  };
  const select = (id: string | null) => selectMany(id ? [id] : []);
  /** Shift/Ctrl-click: add a layer to the selection, or take it out. */
  const toggleSelect = (id: string) =>
    selectMany(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  const selectAll = () => selectMany(canvas.layers.filter((l) => l.visible && !l.locked).map((l) => l.id));

  const addMany = (layers: Layer[]) => {
    setLayers((ls) => [...ls, ...layers]);
    selectMany(layers.map((l) => l.id));
  };
  const add = (layer: Layer) => addMany([layer]);
  const remove = (ids: string[]) => {
    setLayers((ls) => ls.filter((l) => !ids.includes(l.id)));
    select(null);
  };
  const copyOf = (l: Layer): Layer => ({ ...l, id: crypto.randomUUID(), locked: false, x: l.x + 24, y: l.y + 24 });
  const paste = () => {
    if (!clipboard.length) return;
    // Each paste lands a little further along, like Canva.
    const copies = clipboard.map(copyOf);
    setClipboard(copies);
    addMany(copies);
  };
  const duplicate = (ids: string[]) => addMany(canvas.layers.filter((l) => ids.includes(l.id)).map(copyOf));
  const patchEach = (ids: string[], p: Partial<Layer>, group: string | null = null) =>
    setLayers((ls) => ls.map((l) => (ids.includes(l.id) ? ({ ...l, ...p } as Layer) : l)), group);

  /** Move layers by per-layer offsets as a single undo step. */
  const shift = (offsets: Map<string, { dx: number; dy: number }>, group: string | null = null) =>
    setLayers((ls) => {
      let moved = false;
      const next = ls.map((l) => {
        const d = offsets.get(l.id);
        if (!d || (!d.dx && !d.dy)) return l;
        moved = true;
        return { ...l, x: l.x + d.dx, y: l.y + d.dy };
      });
      return moved ? next : ls;
    }, group);

  /** Measure a node on the page as it would be with `attrs`, without committing them. */
  const measure = (id: string, attrs?: Record<string, number>): Box | null => {
    const node = nodes.current.get(id);
    const page = pageRef.current;
    if (!node || !page) return null;
    if (!attrs) return node.getClientRect({ relativeTo: page });
    const before = Object.fromEntries(Object.keys(attrs).map((k) => [k, node.getAttr(k)]));
    node.setAttrs(attrs);
    const box = node.getClientRect({ relativeTo: page });
    node.setAttrs(before);
    return box;
  };

  /** Unlocked layers among `ids`, with their boxes on the page. */
  const movable = (ids: string[]) =>
    canvas.layers
      .filter((l) => ids.includes(l.id) && !l.locked)
      .flatMap((l) => {
        const box = measure(l.id);
        return box ? [{ id: l.id, box }] : [];
      });

  /** One layer aligns to the page; several align to each other. */
  const align: Editor["align"] = (ids, where) => {
    const items = movable(ids);
    if (!items.length) return;
    const offsets =
      items.length === 1 ? [alignToPage(items[0].box, canvas, where)] : alignBoxes(items.map((i) => i.box), where);
    shift(new Map(items.map((item, i) => [item.id, offsets[i]])));
  };

  const distribute: Editor["distribute"] = (ids, axis) => {
    const items = movable(ids);
    const offsets = distributeBoxes(items.map((i) => i.box), axis);
    shift(new Map(items.map((item, i) => [item.id, offsets[i]])));
  };

  const flip: Editor["flip"] = (id, axis) => {
    const l = canvas.layers.find((x) => x.id === id);
    const before = measure(id);
    const next: Record<string, number> = axis === "x" ? { scaleX: -(l?.scaleX ?? 1) } : { scaleY: -(l?.scaleY ?? 1) };
    const after = measure(id, next);
    if (!l || !before || !after) return;
    // Flip in place: keep the visual centre where it was.
    patch(id, {
      ...next,
      x: l.x + before.x + before.width / 2 - (after.x + after.width / 2),
      y: l.y + before.y + before.height / 2 - (after.y + after.height / 2),
    });
  };

  const fitToPage: Editor["fitToPage"] = (id) => {
    const l = canvas.layers.find((x) => x.id === id);
    const box = measure(id);
    if (!l || !box) return;
    const k = fitScale(box, canvas);
    const scaled = { scaleX: l.scaleX * k, scaleY: l.scaleY * k };
    const after = measure(id, scaled);
    if (!after) return;
    patch(id, {
      ...scaled,
      x: l.x + (W - after.width) / 2 - after.x,
      y: l.y + (H - after.height) / 2 - after.y,
    });
  };

  const placeImage: Editor["placeImage"] = async (product, url, at) => {
    try {
      const img = await loadImage(url);
      const current = canvas.layers.find((l) => l.id === swapId);
      if (current?.kind === "image") {
        // Keep the box width, position and rotation; follow the new aspect ratio.
        patch(current.id, {
          url,
          product_id: product.id,
          name: product.name,
          height: (current.width * img.naturalHeight) / img.naturalWidth,
        });
        setSwapId(null);
        select(current.id);
        return;
      }
      const k = Math.min(1, (Math.min(W, H) * 0.45) / Math.max(img.naturalWidth, img.naturalHeight));
      const width = img.naturalWidth * k;
      const height = img.naturalHeight * k;
      const cx = at?.x ?? W / 2;
      const cy = at?.y ?? H / 2;
      add({ ...baseLayer(cx - width / 2, cy - height / 2), kind: "image", name: product.name, product_id: product.id, url, width, height });
    } catch {
      setToast({ kind: "error", text: "That image could not be loaded. If it's an external link, upload it to the product instead." });
    }
  };

  const uploadBackground = async (file: File) => {
    const fd = new FormData();
    fd.set("hamperId", hamperId);
    fd.set("file", file);
    const res = await uploadHamperBackground(fd);
    if (res.error || !res.url) return setToast({ kind: "error", text: res.error ?? "Upload failed." });
    change((c) => ({ ...c, background: { ...c.background, image_url: res.url! } }));
  };

  const cutOut: Editor["cutOut"] = async (id, tolerance) => {
    const layer = canvas.layers.find((l) => l.id === id);
    if (layer?.kind !== "image" || !layer.product_id) return;
    setRemoving(true);
    try {
      const img = await loadImage(layer.url);
      // ponytail: capped at 2000px so a huge photo can't freeze the tab.
      const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const pixels = ctx.getImageData(0, 0, c.width, c.height);
      removeBackground(pixels.data, c.width, c.height, tolerance);
      ctx.putImageData(pixels, 0, 0);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      if (!blob) throw new Error("render failed");

      const fd = new FormData();
      fd.set("file", new File([blob], "cutout.png", { type: "image/png" }));
      fd.set("productId", layer.product_id);
      fd.set("isPrimary", "false");
      fd.set("caption", "Background removed");
      const res = await uploadProductImage(fd);
      if (res.error || !res.image) return setToast({ kind: "error", text: res.error ?? "Upload failed." });
      patch(id, { url: res.image.url });
      setToast({ kind: "ok", text: "Background removed. The cut-out is saved to the product's images." });
    } catch {
      setToast({ kind: "error", text: "Could not process that image." });
    } finally {
      setRemoving(false);
    }
  };

  const documentColors = useMemo(() => {
    const set = new Set<string>();
    const addFill = (f: HamperCanvas["background"]["fill"]) =>
      f.type === "solid" ? set.add(f.color) : (set.add(f.from), set.add(f.to));
    addFill(canvas.background.fill);
    for (const l of canvas.layers) {
      if (l.kind === "image") continue;
      addFill(l.fill);
      if ("stroke" in l && l.strokeWidth > 0) set.add(l.stroke);
    }
    return [...set];
  }, [canvas]);

  const ed: Editor = {
    canvas,
    selected,
    selection,
    selectedIds,
    documentColors,
    select,
    selectMany,
    toggleSelect,
    change,
    patch,
    patchEach,
    tweak,
    add,
    remove,
    duplicate,
    move: (ids, m) => setLayers((ls) => moveLayers(ls, ids, m)),
    reorder: (id, to) => setLayers((ls) => reorderLayer(ls, id, to)),
    align,
    distribute,
    flip,
    fitToPage,
    placeImage,
    swapId,
    startSwap: (id) => {
      setSwapId(id);
      if (id) setTab("products");
    },
    uploadBackground,
    cutOut,
    removing,
  };

  /* --------------------------------------------------------- save/export */
  async function renderPng(): Promise<Blob> {
    await document.fonts.ready;
    const page = pageRef.current;
    if (!page) throw new Error("not ready");
    const out = page.toCanvas({ x: ox, y: oy, width: W * zoom, height: H * zoom, pixelRatio: 1 / zoom });
    return new Promise((resolve, reject) => {
      try {
        out.toBlob((b) => (b ? resolve(b) : reject(new Error("empty"))), "image/png");
      } catch (e) {
        reject(e);
      }
    });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setEditingId(null);
    try {
      let blob: Blob;
      try {
        blob = await renderPng();
      } catch {
        return setToast({ kind: "error", text: "Export blocked by an image from another website. Upload that image to the product instead." });
      }
      const doc = canvas;
      const fd = new FormData();
      fd.set("hamperId", hamperId);
      fd.set("canvas", JSON.stringify(doc));
      fd.set("png", new File([blob], "cover.png", { type: "image/png" }));
      const res = await saveHamperCanvas(fd);
      if (res.error) return setToast({ kind: "error", text: res.error });
      setSavedCanvas(doc);
      setToast({ kind: "ok", text: "Saved. The hamper image is updated." });
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    try {
      const url = URL.createObjectURL(await renderPng());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${hamperCode}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast({ kind: "error", text: "Could not export the image." });
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === "error" ? 7000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The editor is full-screen; stop the page behind it scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* ------------------------------------------------------------ keyboard */
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (typing) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) setSpaceDown(true);
        return;
      }
      if (mod && key === "z") {
        e.preventDefault();
        setHist(e.shiftKey ? redo : undo);
      } else if (mod && key === "y") {
        e.preventDefault();
        setHist(redo);
      } else if (mod && key === "a") {
        e.preventDefault();
        selectAll();
      } else if (mod && key === "c" && selection.length) {
        setClipboard(selection);
      } else if (mod && key === "v" && clipboard.length) {
        e.preventDefault();
        paste();
      } else if (mod && key === "d" && selection.length) {
        e.preventDefault();
        duplicate(selectedIds);
      } else if (mod && (e.code === "BracketRight" || e.code === "BracketLeft") && selection.length) {
        e.preventDefault();
        const up = e.code === "BracketRight";
        ed.move(selectedIds, e.shiftKey ? (up ? "front" : "back") : up ? "forward" : "backward");
      } else if (mod && key === "0") {
        e.preventDefault();
        zoomFit();
      } else if (mod && (key === "=" || key === "+")) {
        e.preventDefault();
        zoomTo((z) => z * 1.25);
      } else if (mod && key === "-") {
        e.preventDefault();
        zoomTo((z) => z / 1.25);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selection.length) {
        e.preventDefault();
        remove(selectedIds);
      } else if (e.key.startsWith("Arrow") && selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const ids = selection.filter((l) => !l.locked).map((l) => l.id);
        shift(new Map(ids.map((id) => [id, { dx, dy }])), `nudge:${ids.join()}`);
      } else if (e.key === "Enter" && selected?.kind === "text" && !selected.locked) {
        e.preventDefault();
        setEditingId(selected.id);
      } else if (e.key === "Escape") {
        if (menu) setMenu(null);
        else if (swapId) setSwapId(null);
        else select(null);
      }
    };
    const onUp = (e: KeyboardEvent) => e.code === "Space" && setSpaceDown(false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  });

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  /* ------------------------------------------------------- konva wiring */
  useEffect(() => {
    // A lone locked layer still shows its box; in a group, locked layers stay out so they don't move.
    const attach = editingId
      ? []
      : canvas.layers
          .filter((l) => selectedIds.includes(l.id) && l.visible && (selectedIds.length === 1 || !l.locked))
          .flatMap((l) => nodes.current.get(l.id) ?? []);
    trRef.current?.nodes(attach);
    trRef.current?.getLayer()?.batchDraw();
  }, [selectedIds, editingId, canvas.layers, fontTick, zoom]);

  // Size the inline text editor to its content.
  useLayoutEffect(() => {
    const el = editRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing?.text, editing?.fontSize, editing?.width, zoom, editingId]);

  const bgImage = useImage(canvas.background.image_url);
  const bgCover = bgImage ? Math.max(W / bgImage.naturalWidth, H / bgImage.naturalHeight) : 1;

  /** Write nodes' on-screen position/rotation/scale back to the document, as one undo step. */
  const commitNodes = (ids: string[]) =>
    setLayers((ls) =>
      ls.map((l) => {
        const n = ids.includes(l.id) ? nodes.current.get(l.id) : undefined;
        if (!n) return l;
        return {
          ...l,
          x: n.x(),
          y: n.y(),
          rotation: n.rotation(),
          scaleX: n.scaleX(),
          scaleY: n.scaleY(),
          ...(l.kind === "text" ? { width: n.width() } : {}),
        } as Layer;
      }),
    );

  /** Rubber-band selection from a press on empty page or pasteboard. */
  function startMarquee(evt: MouseEvent, additive: boolean) {
    const el = boardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const start = { x: evt.clientX - r.left, y: evt.clientY - r.top };
    const keep = additive ? selectedIds : [];
    let box: Box | null = null;
    const move = (ev: PointerEvent) => {
      const x = ev.clientX - r.left;
      const y = ev.clientY - r.top;
      box = { x: Math.min(start.x, x), y: Math.min(start.y, y), width: Math.abs(x - start.x), height: Math.abs(y - start.y) };
      setMarquee(box);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setMarquee(null);
      const area = box as Box | null;
      if (!area || (area.width < 4 && area.height < 4)) return;
      // Stage coordinates are board coordinates: the stage fills the board at 0,0.
      const hit = canvas.layers
        .filter((l) => {
          const n = nodes.current.get(l.id);
          return l.visible && !l.locked && n && intersects(n.getClientRect(), area);
        })
        .map((l) => l.id);
      selectMany([...new Set([...keep, ...hit])]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const register = (id: string) => (node: Konva.Node | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  };

  const common = (l: Layer) => ({
    ref: register(l.id),
    x: l.x,
    y: l.y,
    rotation: l.rotation,
    scaleX: l.scaleX,
    scaleY: l.scaleY,
    opacity: l.opacity,
    visible: l.visible && editingId !== l.id,
    draggable: !l.locked && !spaceDown,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0 || spaceDown) return;
      if (e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey) toggleSelect(l.id);
      // Pressing on part of a selection keeps it, so the whole group can be dragged.
      else if (!selectedIds.includes(l.id)) select(l.id);
    },
    onTap: () => select(l.id),
    onContextMenu: (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      if (!selectedIds.includes(l.id)) select(l.id);
      setMenu({ x: e.evt.clientX, y: e.evt.clientY });
    },
    onMouseEnter: (e: Konva.KonvaEventObject<MouseEvent>) => {
      const page = pageRef.current;
      if (page && !selectedIds.includes(l.id)) setHover(e.target.getClientRect({ relativeTo: page }));
    },
    onMouseLeave: () => setHover(null),
    onDragStart: () => {
      // The Transformer starts dragging the rest of the selection too; only the first counts.
      dragLead.current ??= l.id;
      setHover(null);
    },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      if (dragLead.current !== l.id) return;
      const page = pageRef.current;
      if (!page || e.evt.altKey) return setGuides(null);
      // Snap the selection's combined box, then move every selected node by the same amount.
      const moving = selectedIds.includes(l.id) ? selectedIds : [l.id];
      const movingNodes = moving.flatMap((id) => nodes.current.get(id) ?? []);
      const others = canvas.layers
        .filter((o) => !moving.includes(o.id) && o.visible)
        .flatMap((o) => nodes.current.get(o.id)?.getClientRect({ relativeTo: page }) ?? []);
      const s = snap(boundsOf(movingNodes.map((n) => n.getClientRect({ relativeTo: page }))), others, canvas, 6 / zoom);
      for (const n of movingNodes) {
        n.x(n.x() + s.dx);
        n.y(n.y() + s.dy);
      }
      setGuides((g) =>
        g && g.vertical[0] === s.vertical[0] && g.horizontal[0] === s.horizontal[0]
          ? g
          : { vertical: s.vertical, horizontal: s.horizontal },
      );
    },
    onDragEnd: () => {
      if (dragLead.current !== l.id) return;
      dragLead.current = null;
      setGuides(null);
      commitNodes(selectedIds.includes(l.id) ? selectedIds : [l.id]);
    },
    onTransform: (e: Konva.KonvaEventObject<Event>) => {
      if (l.kind !== "text" || selectedIds.length > 1) return;
      // Side handles change a text box's width (re-wrapping); corners scale it.
      const anchor = trRef.current?.getActiveAnchor();
      if (anchor === "middle-left" || anchor === "middle-right") {
        const n = e.target as Konva.Text;
        n.width(Math.max(30, (n.width() * n.scaleX()) / n.scaleY()));
        n.scaleX(n.scaleY());
      }
    },
  });

  const multi = selection.length > 1;
  const anchors =
    multi || selected?.kind === "image"
      ? ["top-left", "top-right", "bottom-left", "bottom-right"]
      : selected?.kind === "text"
        ? ["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right"]
        : undefined;

  const editColor = editing ? (editing.fill.type === "solid" ? editing.fill.color : editing.fill.from) : undefined;

  /* ------------------------------------------------------------- render */
  return (
    <div className="studio fixed inset-0 z-[60] flex flex-col bg-[var(--st-bg)]">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-[var(--st-line)] bg-[var(--st-panel)] px-2">
        <Link
          href={`/hampers/${encodeURIComponent(hamperCode)}`}
          className={toolBtn}
          onClick={(e) => {
            if (dirty && !confirm("You have unsaved changes. Leave without saving?")) e.preventDefault();
          }}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <span className="mx-2 h-5 w-px bg-[var(--st-line)]" />
        <div className="mr-3 min-w-0">
          <div className="truncate text-[13px] font-semibold leading-tight">{hamperName}</div>
          <div className="text-[11px] leading-tight text-[var(--st-muted)]">{hamperCode}</div>
        </div>
        <ToolButton title="Undo (Ctrl+Z)" disabled={!hist.past.length} onClick={() => setHist(undo)}>
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Redo (Ctrl+Shift+Z)" disabled={!hist.future.length} onClick={() => setHist(redo)}>
          <Redo2 className="h-4 w-4" />
        </ToolButton>
        <Popover title="Resize" width={260} trigger={<><Scaling className="h-4 w-4" /> Resize</>}>
          {(close) => (
            <div className="space-y-1">
              {CANVAS_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    change((c) => ({ ...c, width: p.width, height: p.height }));
                    zoomFit();
                    close();
                  }}
                  className={cx(
                    "flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-[var(--st-hover)]",
                    p.width === W && p.height === H && "text-[var(--st-accent)]",
                  )}
                >
                  {p.label}
                  <span className="text-[11px] tabular-nums text-[var(--st-muted)]">
                    {p.width}×{p.height}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Popover>

        <span className="ml-auto mr-2 flex items-center gap-1.5 text-[12px] text-[var(--st-muted)]">
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
            </>
          ) : dirty ? (
            "Unsaved changes"
          ) : (
            <>
              <Check className="h-3.5 w-3.5" /> All changes saved
            </>
          )}
        </span>
        <ToolButton title="Download PNG" onClick={download}>
          <Download className="h-4 w-4" /> Download
        </ToolButton>
        <button type="button" className={cx(accentBtn, "ml-1")} onClick={save} disabled={saving} title="Save (Ctrl+S)">
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <Rail tab={tab} onTab={setTab} />
        {tab && (
          <SidePanel tab={tab} onClose={() => setTab(null)} ed={ed} products={products} hamperProductIds={hamperProductIds} />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <ContextToolbar ed={ed} />

          {/* Pasteboard */}
          <div
            ref={boardRef}
            className={cx("relative min-h-0 flex-1 overflow-hidden", spaceDown && "cursor-grab")}
            onPointerDown={(e) => {
              // Space+drag or middle-drag pans, After Effects style.
              if (!(spaceDown || e.button === 1)) return;
              e.preventDefault();
              const el = e.currentTarget;
              el.setPointerCapture(e.pointerId);
              let last = { x: e.clientX, y: e.clientY };
              const move = (ev: PointerEvent) => {
                const d = { x: ev.clientX - last.x, y: ev.clientY - last.y };
                last = { x: ev.clientX, y: ev.clientY };
                setView((v) => ({ zoom: v.zoom ?? fit, panX: v.panX + d.x, panY: v.panY + d.y }));
              };
              const up = () => {
                el.removeEventListener("pointermove", move);
                el.removeEventListener("pointerup", up);
              };
              el.addEventListener("pointermove", move);
              el.addEventListener("pointerup", up);
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes(DRAG_MIME)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={(e) => {
              const raw = e.dataTransfer.getData(DRAG_MIME);
              if (!raw) return;
              e.preventDefault();
              const { product, url } = JSON.parse(raw) as { product: PickerProduct; url: string };
              stageRef.current?.setPointersPositions(e.nativeEvent);
              const at = pageRef.current?.getRelativePointerPosition() ?? undefined;
              setSwapId(null);
              placeImage(product, url, at);
            }}
          >
            {board.w > 0 && (
              <Stage
                ref={stageRef}
                width={board.w}
                height={board.h}
                onMouseDown={(e) => {
                  const name = e.target.name();
                  const empty = e.target === e.target.getStage() || name === "bg" || name === "page-shadow";
                  if (!empty || e.evt.button !== 0 || spaceDown) return;
                  const additive = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
                  if (!additive) select(null);
                  startMarquee(e.evt, additive);
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  if (e.target === e.target.getStage() || e.target.name() === "bg") {
                    select(null);
                    setMenu({ x: e.evt.clientX, y: e.evt.clientY });
                  }
                }}
              >
                <KLayer>
                  <Rect
                    name="page-shadow"
                    x={ox}
                    y={oy}
                    width={W * zoom}
                    height={H * zoom}
                    fill="#ffffff"
                    shadowColor="#000000"
                    shadowBlur={40}
                    shadowOpacity={0.55}
                    listening={false}
                  />

                  <Group ref={pageRef} x={ox} y={oy} scaleX={zoom} scaleY={zoom} clipX={0} clipY={0} clipWidth={W} clipHeight={H}>
                    <Rect name="bg" width={W} height={H} {...fillProps(canvas.background.fill, W, H)} />
                    {bgImage && (
                      <KImage
                        image={bgImage}
                        listening={false}
                        width={bgImage.naturalWidth * bgCover}
                        height={bgImage.naturalHeight * bgCover}
                        x={(W - bgImage.naturalWidth * bgCover) / 2}
                        y={(H - bgImage.naturalHeight * bgCover) / 2}
                      />
                    )}

                    {canvas.layers.map((l) => {
                      const stroke = "stroke" in l ? { stroke: l.stroke, strokeWidth: l.strokeWidth } : {};
                      switch (l.kind) {
                        case "image":
                          return <LayerImage key={l.id} layer={l} common={common(l)} />;
                        case "text":
                          return (
                            <Text
                              key={`${l.id}:${fontTick}`}
                              {...common(l)}
                              text={l.text}
                              fontSize={l.fontSize}
                              fontFamily={l.fontFamily}
                              fontStyle={l.fontStyle}
                              align={l.align}
                              width={l.width}
                              letterSpacing={l.letterSpacing}
                              lineHeight={l.lineHeight}
                              onDblClick={() => !l.locked && setEditingId(l.id)}
                              onDblTap={() => !l.locked && setEditingId(l.id)}
                              {...fillProps(l.fill, l.width, l.fontSize * l.lineHeight * l.text.split("\n").length)}
                            />
                          );
                        case "rect":
                          return (
                            <Rect
                              key={l.id}
                              {...common(l)}
                              {...stroke}
                              width={l.width}
                              height={l.height}
                              cornerRadius={l.cornerRadius}
                              {...fillProps(l.fill, l.width, l.height)}
                            />
                          );
                        case "ellipse":
                          return (
                            <Ellipse
                              key={l.id}
                              {...common(l)}
                              {...stroke}
                              radiusX={l.radiusX}
                              radiusY={l.radiusY}
                              {...fillProps(l.fill, l.radiusX * 2, l.radiusY * 2, -l.radiusX, -l.radiusY)}
                            />
                          );
                        case "polygon":
                          return (
                            <RegularPolygon
                              key={l.id}
                              {...common(l)}
                              {...stroke}
                              sides={l.sides}
                              radius={l.radius}
                              {...fillProps(l.fill, l.radius * 2, l.radius * 2, -l.radius, -l.radius)}
                            />
                          );
                        case "star":
                          return (
                            <Star
                              key={l.id}
                              {...common(l)}
                              {...stroke}
                              numPoints={l.numPoints}
                              innerRadius={l.innerRadius}
                              outerRadius={l.outerRadius}
                              {...fillProps(l.fill, l.outerRadius * 2, l.outerRadius * 2, -l.outerRadius, -l.outerRadius)}
                            />
                          );
                      }
                    })}
                  </Group>

                  {/* Overlays in page coordinates, drawn outside the clip and never exported. */}
                  <Group x={ox} y={oy} scaleX={zoom} scaleY={zoom} listening={false}>
                    {hover && !guides && !marquee && (
                      <Rect {...hover} stroke={ACCENT} strokeWidth={1.5 / zoom} dash={[4 / zoom, 3 / zoom]} />
                    )}
                    {guides?.vertical.map((x) => (
                      <Line key={`v${x}`} points={[x, -40 / zoom, x, H + 40 / zoom]} stroke="#ff3b8d" strokeWidth={1 / zoom} />
                    ))}
                    {guides?.horizontal.map((y) => (
                      <Line key={`h${y}`} points={[-40 / zoom, y, W + 40 / zoom, y]} stroke="#ff3b8d" strokeWidth={1 / zoom} />
                    ))}
                  </Group>

                  <Transformer
                    ref={trRef}
                    rotateEnabled={!selected?.locked}
                    resizeEnabled={!selected?.locked}
                    keepRatio={multi || selected?.kind === "image" || selected?.kind === "text"}
                    onTransformEnd={() => commitNodes(selectedIds)}
                    enabledAnchors={anchors}
                    flipEnabled={false}
                    rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                    rotationSnapTolerance={4}
                    rotateAnchorOffset={28}
                    anchorSize={10}
                    anchorCornerRadius={5}
                    anchorStroke={ACCENT}
                    anchorStrokeWidth={1.5}
                    anchorFill="#ffffff"
                    borderStroke={selected?.locked ? "#9b9ea6" : ACCENT}
                    borderStrokeWidth={1.5}
                    boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8 ? oldBox : newBox)}
                  />
                </KLayer>
              </Stage>
            )}

            {/* Inline text editing, positioned over the text it replaces. */}
            {editing && (
              <textarea
                ref={editRef}
                autoFocus
                value={editing.text}
                spellCheck={false}
                onFocus={(e) => e.target.select()}
                onChange={(e) => tweak(editing.id, { text: e.target.value })}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
                className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 outline outline-2 outline-[var(--st-accent)]"
                style={{
                  left: ox + editing.x * zoom,
                  top: oy + editing.y * zoom,
                  width: editing.width * Math.abs(editing.scaleX) * zoom,
                  fontSize: editing.fontSize * Math.abs(editing.scaleY) * zoom,
                  fontFamily: editing.fontFamily,
                  fontWeight: editing.fontStyle.includes("bold") ? 700 : 400,
                  fontStyle: editing.fontStyle.includes("italic") ? "italic" : "normal",
                  textAlign: editing.align,
                  lineHeight: editing.lineHeight,
                  letterSpacing: editing.letterSpacing * Math.abs(editing.scaleX) * zoom,
                  color: editColor,
                  opacity: editing.opacity,
                  transform: `rotate(${editing.rotation}deg)`,
                  transformOrigin: "top left",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "break-word",
                }}
              />
            )}

            {marquee && (
              <div
                className="pointer-events-none absolute rounded-sm border border-[var(--st-accent)] bg-[var(--st-accent-soft)]"
                style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }}
              />
            )}

            {swapId && (
              <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-[var(--st-accent)] px-4 py-1.5 text-[12px] font-medium text-white shadow-lg">
                Choose a new image from the Products panel
              </div>
            )}

            {toast && (
              <div
                role="status"
                className={cx(
                  "absolute bottom-4 left-1/2 max-w-md -translate-x-1/2 rounded-lg px-4 py-2.5 text-[13px] shadow-2xl",
                  toast.kind === "error" ? "bg-red-600 text-white" : "bg-[#f4f4f5] text-[#18181b]",
                )}
              >
                {toast.text}
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <footer className="flex h-10 shrink-0 items-center gap-2 border-t border-[var(--st-line)] bg-[var(--st-panel)] px-3">
            <Popover title="Keyboard shortcuts" width={330} trigger={<Keyboard className="h-4 w-4" />}>
              <div className={cx(panelTitle, "mb-2")}>Keyboard shortcuts</div>
              <dl className="space-y-1.5">
                {SHORTCUTS.map(([what, keys]) => (
                  <div key={what} className="flex justify-between gap-3 text-[12px]">
                    <dt className="text-[var(--st-muted)]">{what}</dt>
                    <dd className="text-right font-mono text-[11px]">{keys}</dd>
                  </div>
                ))}
              </dl>
            </Popover>
            <span className="text-[12px] text-[var(--st-muted)]">
              {W} × {H} px · {canvas.layers.length} layer{canvas.layers.length === 1 ? "" : "s"}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <ToolButton title="Zoom out (Ctrl+-)" className="h-7 w-7 px-0" onClick={() => zoomTo((z) => z / 1.25)}>
                <Minus className="h-3.5 w-3.5" />
              </ToolButton>
              <input
                type="range"
                aria-label="Zoom"
                min={Math.log(ZOOM_MIN)}
                max={Math.log(ZOOM_MAX)}
                step={0.01}
                value={Math.log(zoom)}
                onChange={(e) => zoomTo(() => Math.exp(Number(e.target.value)))}
                className="w-32"
              />
              <ToolButton title="Zoom in (Ctrl+=)" className="h-7 w-7 px-0" onClick={() => zoomTo((z) => z * 1.25)}>
                <Plus className="h-3.5 w-3.5" />
              </ToolButton>
              <span className="w-12 text-right text-[12px] tabular-nums">{Math.round(zoom * 100)}%</span>
              <ToolButton title="Fit page to screen (Ctrl+0)" active={view.zoom === null} onClick={zoomFit}>
                Fit
              </ToolButton>
            </div>
          </footer>
        </div>

        <aside className="hidden w-[280px] shrink-0 flex-col border-l border-[var(--st-line)] bg-[var(--st-panel)] lg:flex">
          <LayersPanel ed={ed} />
          <TransformPanel ed={ed} />
        </aside>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={
            selection.length
              ? [
                  ["Copy", "Ctrl+C", () => setClipboard(selection)],
                  ["Paste", "Ctrl+V", clipboard.length ? paste : null],
                  [multi ? `Duplicate ${selection.length} elements` : "Duplicate", "Ctrl+D", () => duplicate(selectedIds)],
                  [multi ? `Delete ${selection.length} elements` : "Delete", "Del", () => remove(selectedIds)],
                  null,
                  ["Bring forward", "Ctrl+]", () => ed.move(selectedIds, "forward")],
                  ["Bring to front", "Ctrl+Shift+]", () => ed.move(selectedIds, "front")],
                  ["Send backward", "Ctrl+[", () => ed.move(selectedIds, "backward")],
                  ["Send to back", "Ctrl+Shift+[", () => ed.move(selectedIds, "back")],
                  null,
                  ...(selected?.kind === "image"
                    ? ([
                        ["Swap image", "", () => ed.startSwap(selected.id)],
                        ["Fit to page", "", () => fitToPage(selected.id)],
                      ] as MenuItem[])
                    : []),
                  ...(multi
                    ? ([
                        ["Align centres", "", () => align(selectedIds, "center")],
                        ["Align middles", "", () => align(selectedIds, "middle")],
                      ] as MenuItem[])
                    : ([["Align to page centre", "", () => (align(selectedIds, "center"), align(selectedIds, "middle"))]] as MenuItem[])),
                  (() => {
                    const allLocked = selection.every((l) => l.locked);
                    return [allLocked ? "Unlock" : "Lock", "", () => patchEach(selectedIds, { locked: !allLocked })] as MenuItem;
                  })(),
                  ["Hide", "", () => patchEach(selectedIds, { visible: false })],
                ]
              : [
                  ["Paste", "Ctrl+V", clipboard.length ? paste : null],
                  ["Select all", "Ctrl+A", canvas.layers.length ? selectAll : null],
                  ["Fit page to screen", "Ctrl+0", zoomFit],
                ]
          }
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

type MenuItem = [label: string, keys: string, run: (() => unknown) | null] | null;

function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  // Keep the menu on screen near the right and bottom edges.
  const left = Math.min(x, window.innerWidth - 240);
  const top = Math.min(y, window.innerHeight - items.length * 30 - 16);
  return (
    <div
      role="menu"
      className="studio fixed z-[70] w-56 rounded-lg border border-[var(--st-line)] bg-[var(--st-panel)] p-1 shadow-2xl shadow-black/60"
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} className="my-1 h-px bg-[var(--st-line)]" />
        ) : (
          <button
            key={item[0]}
            type="button"
            role="menuitem"
            disabled={!item[2]}
            onClick={() => {
              item[2]?.();
              onClose();
            }}
            className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-[var(--st-hover)] disabled:opacity-35 disabled:hover:bg-transparent"
          >
            {item[0]}
            <span className="text-[11px] text-[var(--st-muted)]">{item[1]}</span>
          </button>
        ),
      )}
    </div>
  );
}

function LayerImage({ layer, common }: { layer: Extract<Layer, { kind: "image" }>; common: Record<string, unknown> }) {
  const img = useImage(layer.url);
  return <KImage {...common} image={img} width={layer.width} height={layer.height} />;
}
