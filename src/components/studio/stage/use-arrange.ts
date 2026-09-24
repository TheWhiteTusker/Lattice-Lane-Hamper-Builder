import type { RefObject } from "react";
import type Konva from "konva";
import { alignBoxes, alignToPage, distributeBoxes, fitScale, type Box } from "@/lib/hamper-canvas";
import type { Editor } from "../editor";
import type { CanvasDoc } from "./use-canvas-doc";

/** Align, distribute, flip and fit, measured from the drawn Konva nodes. */
export function useArrange(
  doc: CanvasDoc,
  nodes: RefObject<Map<string, Konva.Node>>,
  pageRef: RefObject<Konva.Group | null>,
) {
  const { canvas, patch, shift } = doc;

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
      x: l.x + (canvas.width - after.width) / 2 - after.x,
      y: l.y + (canvas.height - after.height) / 2 - after.y,
    });
  };

  return { align, distribute, flip, fitToPage };
}
