import { z } from "zod";

/*
 * The hamper image designer's document. Stored as-is in hampers.canvas.
 * Layer array order is z-order: the last layer is drawn on top.
 */

export const CANVAS_PRESETS = [
  { label: "Square 1:1", width: 1080, height: 1080 },
  { label: "Portrait 4:5", width: 1080, height: 1350 },
  { label: "Story 9:16", width: 1080, height: 1920 },
  { label: "Landscape 16:9", width: 1920, height: 1080 },
  { label: "A4 portrait", width: 1240, height: 1754 },
] as const;

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const FillSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("solid"), color }),
  z.object({ type: z.literal("linear"), from: color, to: color, angle: z.number() }),
]);

// visible/locked/name arrived after the first saved designs, hence the defaults.
const base = {
  id: z.string().min(1),
  name: z.string().optional(),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  scaleX: z.number(),
  scaleY: z.number(),
  opacity: z.number().min(0).max(1),
};

const shapeStyle = {
  fill: FillSchema,
  stroke: color,
  strokeWidth: z.number().min(0),
};

export const LayerSchema = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("image"),
    product_id: z.string().uuid().nullable(),
    url: z.string().url(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  z.object({
    ...base,
    kind: z.literal("text"),
    text: z.string(),
    fontSize: z.number().positive(),
    fontFamily: z.string(),
    fontStyle: z.enum(["normal", "bold", "italic", "italic bold"]),
    align: z.enum(["left", "center", "right"]),
    width: z.number().positive(),
    letterSpacing: z.number().default(0),
    lineHeight: z.number().positive().default(1),
    fill: FillSchema,
  }),
  z.object({
    ...base,
    ...shapeStyle,
    kind: z.literal("rect"),
    width: z.number().positive(),
    height: z.number().positive(),
    cornerRadius: z.number().min(0),
  }),
  z.object({
    ...base,
    ...shapeStyle,
    kind: z.literal("ellipse"),
    radiusX: z.number().positive(),
    radiusY: z.number().positive(),
  }),
  z.object({
    ...base,
    ...shapeStyle,
    kind: z.literal("polygon"),
    sides: z.number().int().min(3).max(12),
    radius: z.number().positive(),
  }),
  z.object({
    ...base,
    ...shapeStyle,
    kind: z.literal("star"),
    numPoints: z.number().int().min(3).max(20),
    innerRadius: z.number().positive(),
    outerRadius: z.number().positive(),
  }),
]);

export const CanvasSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  background: z.object({ fill: FillSchema, image_url: z.string().url().nullable() }),
  layers: z.array(LayerSchema),
});

export type Fill = z.infer<typeof FillSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type LayerKind = Layer["kind"];
export type HamperCanvas = z.infer<typeof CanvasSchema>;

export const emptyCanvas = (): HamperCanvas => ({
  width: CANVAS_PRESETS[0].width,
  height: CANVAS_PRESETS[0].height,
  background: { fill: { type: "solid", color: "#ffffff" }, image_url: null },
  layers: [],
});

/** A saved canvas, or a blank one if there is none or it no longer parses. */
export function parseCanvas(raw: unknown): HamperCanvas {
  const parsed = CanvasSchema.safeParse(raw);
  return parsed.success ? parsed.data : emptyCanvas();
}

/** What the Layers panel calls a layer when it has not been renamed. */
export function layerLabel(l: Layer): string {
  if (l.name) return l.name;
  switch (l.kind) {
    case "image":
      return "Image";
    case "text":
      return l.text.trim().split("\n")[0].slice(0, 40) || "Text";
    case "rect":
      return l.cornerRadius > 0 ? "Rounded rectangle" : "Rectangle";
    case "ellipse":
      return "Circle";
    case "polygon":
      return l.sides === 3 ? "Triangle" : l.sides === 6 ? "Hexagon" : `${l.sides}-sided shape`;
    case "star":
      return "Star";
  }
}

/** The fill as CSS, for swatches and layer thumbnails. */
export const fillCss = (fill: Fill) =>
  fill.type === "solid" ? fill.color : `linear-gradient(${fill.angle + 90}deg, ${fill.from}, ${fill.to})`;

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

/**
 * Konva fill props for a shape whose local box starts at (ox, oy) and is w×h.
 * Rect and Text boxes start at 0,0; centred shapes (ellipse, polygon, star)
 * pass -rx, -ry. The gradient line runs through the box centre at `angle`
 * degrees (0 = left→right, 90 = top→bottom), long enough to reach the corners.
 */
export function fillProps(fill: Fill, w: number, h: number, ox = 0, oy = 0) {
  if (fill.type === "solid") return { fill: fill.color };
  const rad = (fill.angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2;
  const cx = ox + w / 2;
  const cy = oy + h / 2;
  return {
    fillPriority: "linear-gradient",
    fillLinearGradientStartPoint: { x: cx - dx * half, y: cy - dy * half },
    fillLinearGradientEndPoint: { x: cx + dx * half, y: cy + dy * half },
    fillLinearGradientColorStops: [0, fill.from, 1, fill.to],
  };
}

/* ---------------------------------------------------------------- history */

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /** Consecutive edits with the same group within GROUP_MS become one step. */
  group: string | null;
  at: number;
};

const HISTORY_LIMIT = 100;
const GROUP_MS = 1000;

export const startHistory = <T>(present: T): History<T> => ({
  past: [],
  present,
  future: [],
  group: null,
  at: 0,
});

/**
 * Record a new present. Pass a group for continuous edits (a slider, a colour
 * picker, typing) so dragging one control is a single undo step, not fifty.
 */
export function record<T>(h: History<T>, next: T, group: string | null, now: number): History<T> {
  if (next === h.present) return h;
  if (group && group === h.group && now - h.at < GROUP_MS) {
    return { ...h, present: next, future: [], at: now };
  }
  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    group,
    at: now,
  };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
    group: null,
    at: 0,
  };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return {
    past: [...h.past, h.present],
    present: h.future[0],
    future: h.future.slice(1),
    group: null,
    at: 0,
  };
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
