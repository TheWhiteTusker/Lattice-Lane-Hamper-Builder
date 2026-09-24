import { useState } from "react";
import { record, startHistory, type HamperCanvas, type Layer } from "@/lib/hamper-canvas";

export type CanvasDoc = ReturnType<typeof useCanvasDoc>;

/** The design with undo history, the selection, and the edits the panels make. */
export function useCanvasDoc(initial: HamperCanvas) {
  const [hist, setHist] = useState(() => startHistory(initial));
  const canvas = hist.present;
  const [savedCanvas, setSavedCanvas] = useState(initial);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [clipboard, setClipboard] = useState<Layer[]>([]);

  // In z-order, so copy/paste and arrange keep the stacking.
  const selection = canvas.layers.filter((l) => selectedIds.includes(l.id));
  const selected = selection.length === 1 ? selection[0] : null;
  const editing = canvas.layers.find((l) => l.id === editingId && l.kind === "text") as
    | Extract<Layer, { kind: "text" }>
    | undefined;

  const change = (fn: (c: HamperCanvas) => HamperCanvas, group: string | null = null) =>
    setHist((h) => record(h, fn(h.present), group, Date.now()));
  const setLayers = (fn: (layers: Layer[]) => Layer[], group: string | null = null) =>
    change((c) => ({ ...c, layers: fn(c.layers) }), group);
  const patch = (id: string, p: Partial<Layer>, group: string | null = null) =>
    setLayers((ls) => ls.map((l) => (l.id === id ? ({ ...l, ...p } as Layer) : l)), group);
  const tweak = (id: string, p: Partial<Layer>) => patch(id, p, `${id}:${Object.keys(p).join()}`);
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

  return {
    hist, setHist, canvas, savedCanvas, setSavedCanvas, dirty: canvas !== savedCanvas,
    selectedIds, selection, selected, editing, editingId, setEditingId, menu, setMenu,
    clipboard, setClipboard, change, setLayers, patch, tweak, patchEach, shift,
    select, selectMany, toggleSelect, selectAll, add, addMany, remove, paste, duplicate,
  };
}

/** Colours already used in the design, offered first in colour pickers. */
export function documentColorsOf(canvas: HamperCanvas) {
  const set = new Set<string>();
  const addFill = (f: HamperCanvas["background"]["fill"]) =>
    f.type === "solid" ? set.add(f.color) : (set.add(f.from), set.add(f.to));
  addFill(canvas.background.fill);
  for (const l of canvas.layers) {
    if (l.kind === "image") continue;
    if ("fill" in l && l.fill) addFill(l.fill);
    if ("stroke" in l && l.strokeWidth > 0) set.add(l.stroke);
  }
  return [...set];
}
