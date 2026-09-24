/** Layer builders shared by every deck slide. */

import type { Fill, HamperCanvas, Layer } from "./hamper-canvas.ts";
import { DECK_COLORS, SLIDE, type Photo } from "./deck-types.ts";

let seq = 0;
const nextId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

const base = (x: number, y: number) => ({
  id: nextId(),
  visible: true,
  locked: false,
  x,
  y,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

const solid = (color: string): Fill => ({ type: "solid", color });

type TextOpts = {
  size: number;
  color: string;
  width: number;
  font?: string;
  style?: "normal" | "bold" | "italic" | "italic bold";
  align?: "left" | "center" | "right";
  spacing?: number;
  lineHeight?: number;
  underline?: boolean;
  name?: string;
};

export const text = (value: string, x: number, y: number, o: TextOpts): Layer => ({
  ...base(x, y),
  kind: "text",
  name: o.name,
  text: value,
  fontFamily: o.font ?? "Arial",
  fontSize: o.size,
  fontStyle: o.style ?? "normal",
  align: o.align ?? "left",
  width: o.width,
  letterSpacing: o.spacing ?? 0,
  lineHeight: o.lineHeight ?? 1.15,
  textDecoration: o.underline ? "underline" : "none",
  fill: solid(o.color),
});

export const rect = (x: number, y: number, width: number, height: number, color: string, name: string): Layer => ({
  ...base(x, y),
  kind: "rect",
  name,
  width,
  height,
  cornerRadius: 0,
  fill: solid(color),
  stroke: DECK_COLORS.ink,
  strokeWidth: 0,
});

export const photo = (url: string, box: { x: number; y: number; width: number; height: number }, productId: string | null, name: string): Layer => ({
  ...base(box.x, box.y),
  kind: "image",
  name,
  product_id: productId,
  url,
  width: box.width,
  height: box.height,
  fit: "stretch",
});

export const page = (background: string, layers: Layer[]): HamperCanvas => ({
  width: SLIDE.width,
  height: SLIDE.height,
  background: { fill: solid(background), image_url: null },
  layers,
});

/** "Essential Hamper" -> ["Essential", "Hamper"], as the deck sets its titles. */
export function splitTitle(name: string, fallbackSubtitle: string): [string, string] {
  const m = name.trim().match(/^(.*\S)\s+(hampers?)$/i);
  return m ? [m[1], m[2][0].toUpperCase() + m[2].slice(1)] : [name.trim(), fallbackSubtitle];
}

export const formatInr = (v: number) => `INR ${Math.round(v).toLocaleString("en-IN")}`;

/** The Lattice Lane logo, `width` px wide, tucked into a corner of the slide. */
export function logoLayer(logo: Photo, width: number, corner: "bottom-right" | "bottom-left" | "top-right"): Layer {
  const height = (width * logo.size.height) / logo.size.width;
  const x = corner === "bottom-left" ? 86 : 1860 - width;
  const y = corner === "top-right" ? 60 : 1010 - height;
  return photo(logo.url, { x, y, width, height }, null, "Logo");
}
