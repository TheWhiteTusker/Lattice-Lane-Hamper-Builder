/** Layer ordering, snapping, alignment and distribution. Re-exported from hamper-canvas.ts. */

export type LayerMove = "front" | "forward" | "backward" | "back";

export function moveLayer<T extends { id: string }>(layers: T[], id: string, move: LayerMove): T[] {
  return moveLayers(layers, [id], move);
}

/**
 * Arrange several layers at once, keeping their order relative to each other.
 * Forward/backward step each one past its nearest unselected neighbour.
 */
export function moveLayers<T extends { id: string }>(layers: T[], ids: string[], move: LayerMove): T[] {
  const pick = new Set(ids);
  if (!layers.some((l) => pick.has(l.id))) return layers;
  const chosen = layers.filter((l) => pick.has(l.id));
  const rest = layers.filter((l) => !pick.has(l.id));
  if (move === "front") return same(layers, [...rest, ...chosen]);
  if (move === "back") return same(layers, [...chosen, ...rest]);

  const next = [...layers];
  const swap = (i: number, j: number) => ([next[i], next[j]] = [next[j], next[i]]);
  if (move === "forward") {
    for (let i = next.length - 2; i >= 0; i--) {
      if (pick.has(next[i].id) && !pick.has(next[i + 1].id)) swap(i, i + 1);
    }
  } else {
    for (let i = 1; i < next.length; i++) {
      if (pick.has(next[i].id) && !pick.has(next[i - 1].id)) swap(i, i - 1);
    }
  }
  return same(layers, next);
}

/** Keep the original array when nothing moved, so history records no step. */
const same = <T>(before: T[], after: T[]) => (after.every((l, i) => l === before[i]) ? before : after);

/** Move a layer so it ends up at array index `to` (drag-and-drop in the Layers panel). */
export function reorderLayer<T extends { id: string }>(layers: T[], id: string, to: number): T[] {
  const from = layers.findIndex((l) => l.id === id);
  const target = Math.max(0, Math.min(to, layers.length - 1));
  if (from < 0 || from === target) return layers;
  const next = [...layers];
  const [layer] = next.splice(from, 1);
  next.splice(target, 0, layer);
  return next;
}

/* ------------------------------------------------------ snapping & aligning */

export type Box = { x: number; y: number; width: number; height: number };

/** Left/centre/right (or top/middle/bottom) lines of a box on one axis. */
const stops = (start: number, size: number) => [start, start + size / 2, start + size];

/**
 * How far to nudge a dragged box so its nearest edge or centre lines up with
 * the canvas or another item, per axis, plus the guide lines to draw.
 * An axis with nothing within `threshold` is left alone.
 */
export function snap(box: Box, others: Box[], canvas: { width: number; height: number }, threshold: number) {
  const axis = (own: number[], targets: number[]) => {
    let best: { delta: number; at: number } | null = null;
    for (const t of targets) {
      for (const o of own) {
        const delta = t - o;
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, at: t };
        }
      }
    }
    return best;
  };

  const v = axis(stops(box.x, box.width), [
    ...stops(0, canvas.width),
    ...others.flatMap((b) => stops(b.x, b.width)),
  ]);
  const h = axis(stops(box.y, box.height), [
    ...stops(0, canvas.height),
    ...others.flatMap((b) => stops(b.y, b.height)),
  ]);

  return {
    dx: v?.delta ?? 0,
    dy: h?.delta ?? 0,
    vertical: v ? [v.at] : [],
    horizontal: h ? [h.at] : [],
  };
}

export type PageAlign = "left" | "center" | "right" | "top" | "middle" | "bottom";

/** Offset that aligns a box to an edge or centre of the page. */
export function alignToPage(box: Box, page: { width: number; height: number }, where: PageAlign) {
  switch (where) {
    case "left":
      return { dx: -box.x, dy: 0 };
    case "center":
      return { dx: (page.width - box.width) / 2 - box.x, dy: 0 };
    case "right":
      return { dx: page.width - box.width - box.x, dy: 0 };
    case "top":
      return { dx: 0, dy: -box.y };
    case "middle":
      return { dx: 0, dy: (page.height - box.height) / 2 - box.y };
    case "bottom":
      return { dx: 0, dy: page.height - box.height - box.y };
  }
}

/** Uniform scale factor that makes a box fit inside the page (never enlarges). */
export const fitScale = (box: Box, page: { width: number; height: number }, margin = 0.9) =>
  Math.min(1, (page.width * margin) / box.width, (page.height * margin) / box.height);

/* -------------------------------------------------------- multi-selection */

/** The smallest box containing all the boxes. */
export function boundsOf(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

export const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Offsets that align each box to the shared edge or centre of the whole selection. */
export function alignBoxes(boxes: Box[], where: PageAlign) {
  const b = boundsOf(boxes);
  return boxes.map((box) => {
    const d = alignToPage({ ...box, x: box.x - b.x, y: box.y - b.y }, b, where);
    return { dx: d.dx + 0, dy: d.dy + 0 }; // + 0 turns -0 into 0
  });
}

/**
 * Offsets that space boxes evenly between the outermost two, which stay put.
 * Order follows position on that axis, not selection order.
 */
export function distributeBoxes(boxes: Box[], axis: "x" | "y") {
  const pos = axis === "x" ? "x" : "y";
  const size = axis === "x" ? "width" : "height";
  const out = boxes.map(() => ({ dx: 0, dy: 0 }));
  if (boxes.length < 3) return out;

  const order = boxes.map((_, i) => i).sort((i, j) => boxes[i][pos] - boxes[j][pos]);
  const first = boxes[order[0]];
  const last = boxes[order[order.length - 1]];
  const span = last[pos] + last[size] - first[pos];
  const gap = (span - boxes.reduce((sum, b) => sum + b[size], 0)) / (boxes.length - 1);

  let cursor = first[pos];
  for (const i of order) {
    const d = cursor - boxes[i][pos];
    out[i] = axis === "x" ? { dx: d, dy: 0 } : { dx: 0, dy: d };
    cursor += boxes[i][size] + gap;
  }
  return out;
}
