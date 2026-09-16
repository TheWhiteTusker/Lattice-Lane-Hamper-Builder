import { formatMoney } from "./pricing.ts";
import type { Fill, HamperCanvas, Layer } from "./hamper-canvas.ts";

/*
 * Presentation decks: an entry slide, one slide per hamper or product, and a
 * closing slide. Each slide is an ordinary designer canvas, so the photo
 * editor edits them like any hamper image.
 */

export const SLIDE = { width: 1920, height: 1080 } as const;

const INK = "#2c332f";
const SAGE = "#54655b";
const GOLD = "#ddcf8b";
const BRONZE = "#b08d57";
const CREAM = "#faf8ee";
const SAND = "#f1ebe0";
const MUTED = "#66756b";

export type HamperInfo = {
  id: string;
  code: string;
  name: string;
  collection: string | null;
  price: number | null;
  image_url: string | null;
  contents: { name: string; qty: number }[];
};

export type ProductInfo = {
  id: string;
  code: string;
  name: string;
  price: number | null;
  image_url: string | null;
  colors: string[];
};

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
  font: string;
  size: number;
  color: string;
  width: number;
  style?: "normal" | "bold" | "italic" | "italic bold";
  align?: "left" | "center" | "right";
  spacing?: number;
  lineHeight?: number;
  name?: string;
};

const text = (value: string, x: number, y: number, o: TextOpts): Layer => ({
  ...base(x, y),
  kind: "text",
  name: o.name,
  text: value,
  fontFamily: o.font,
  fontSize: o.size,
  fontStyle: o.style ?? "normal",
  align: o.align ?? "left",
  width: o.width,
  letterSpacing: o.spacing ?? 0,
  lineHeight: o.lineHeight ?? 1.15,
  fill: solid(o.color),
});

const rect = (x: number, y: number, width: number, height: number, color: string, name?: string): Layer => ({
  ...base(x, y),
  kind: "rect",
  name,
  width,
  height,
  cornerRadius: 0,
  fill: solid(color),
  stroke: INK,
  strokeWidth: 0,
});

const page = (background: Fill, layers: Layer[]): HamperCanvas => ({
  width: SLIDE.width,
  height: SLIDE.height,
  background: { fill: background, image_url: null },
  layers,
});

const wordmark = (x: number, y: number, width: number, align: "left" | "center", color: string, size = 26) =>
  text("LATTICE LANE", x, y, { font: "Cinzel", size, color, width, align, spacing: size * 0.4, name: "Wordmark" });

export function coverSlide(title: string, subtitle: string): HamperCanvas {
  const W = SLIDE.width;
  return page(solid(INK), [
    wordmark(0, 300, W, "center", GOLD, 40),
    rect(W / 2 - 80, 385, 160, 3, GOLD, "Rule"),
    text(title || "Our hamper collection", 160, 440, {
      font: "Playfair Display",
      size: 104,
      style: "bold",
      color: CREAM,
      width: W - 320,
      align: "center",
      name: "Title",
    }),
    text(subtitle, 160, 700, { font: "Montserrat", size: 38, color: GOLD, width: W - 320, align: "center", spacing: 2, name: "Subtitle" }),
  ]);
}

export function closingSlide(title: string, contact: string): HamperCanvas {
  const W = SLIDE.width;
  return page(solid(INK), [
    text(title || "Thank you", 160, 250, { font: "Great Vibes", size: 170, color: GOLD, width: W - 320, align: "center", name: "Title" }),
    rect(W / 2 - 80, 520, 160, 3, GOLD, "Rule"),
    text(contact, 260, 580, { font: "Montserrat", size: 36, color: CREAM, width: W - 520, align: "center", lineHeight: 1.6, name: "Contact" }),
    wordmark(0, 960, W, "center", GOLD),
  ]);
}

/** The shared item layout: photo panel on the left, details on the right. */
function itemSlide(
  item: { code: string; name: string; image_url: string | null; productId: string | null },
  details: (x: number, width: number) => Layer[],
): HamperCanvas {
  const X = 1090;
  const WIDTH = 720;
  const photo: Layer[] = item.image_url
    ? [
        {
          ...base(80, 80),
          kind: "image",
          name: "Photo",
          product_id: item.productId,
          url: item.image_url,
          width: 840,
          height: 920,
          fit: "contain",
        },
      ]
    : [
        text("No image yet", 80, 520, { font: "Montserrat", size: 32, color: MUTED, width: 840, align: "center", name: "No image" }),
      ];

  return page(solid(CREAM), [
    rect(0, 0, 1000, SLIDE.height, SAND, "Photo panel"),
    ...photo,
    text(item.code, X, 110, { font: "Montserrat", size: 26, style: "bold", color: SAGE, width: WIDTH, spacing: 4, name: "Code" }),
    text(item.name, X, 160, { font: "Playfair Display", size: 68, style: "bold", color: INK, width: WIDTH, name: "Name" }),
    rect(X, 345, 120, 4, GOLD, "Rule"),
    ...details(X, WIDTH),
    wordmark(X, 990, WIDTH, "left", BRONZE, 22),
  ]);
}

const MAX_LINES = 11;

/** "• 2 × Walnut tray" lines, capped so a long hamper doesn't run off the slide. */
export function contentsText(contents: { name: string; qty: number }[]): string {
  const lines = contents.map((c) => `•  ${c.qty !== 1 ? `${c.qty} × ` : ""}${c.name}`);
  if (lines.length <= MAX_LINES) return lines.join("\n");
  return [...lines.slice(0, MAX_LINES - 1), `+ ${lines.length - (MAX_LINES - 1)} more`].join("\n");
}

export function hamperSlide(h: HamperInfo): HamperCanvas {
  return itemSlide({ ...h, productId: null }, (x, width) => [
    ...(h.price != null
      ? [text(formatMoney(h.price), x, 385, { font: "Playfair Display", size: 60, style: "bold", color: SAGE, width, name: "Price" })]
      : []),
    ...(h.contents.length
      ? [
          text("WHAT'S INSIDE", x, 500, { font: "Montserrat", size: 24, style: "bold", color: MUTED, width, spacing: 3, name: "Contents heading" }),
          text(contentsText(h.contents), x, 548, { font: "Inter", size: 29, color: INK, width, lineHeight: 1.5, name: "Contents" }),
        ]
      : []),
  ]);
}

export function productSlide(p: ProductInfo): HamperCanvas {
  return itemSlide({ ...p, productId: p.id }, (x, width) => [
    ...(p.price != null
      ? [text(formatMoney(p.price), x, 385, { font: "Playfair Display", size: 60, style: "bold", color: SAGE, width, name: "Price" })]
      : []),
    ...(p.colors.length
      ? [
          text("AVAILABLE IN", x, 500, { font: "Montserrat", size: 24, style: "bold", color: MUTED, width, spacing: 3, name: "Finishes heading" }),
          text(p.colors.join("  ·  "), x, 548, { font: "Inter", size: 32, color: INK, width, name: "Finishes" }),
        ]
      : []),
  ]);
}

export const blankSlide = (): HamperCanvas => page(solid(CREAM), []);

/* ------------------------------------------------------------ PowerPoint */

/** PowerPoint measures in inches; slides use 144 px per inch, so 1920 px = 13.33" (16:9 widescreen). */
export const PX_PER_INCH = 144;

/**
 * A text layer as a native PowerPoint text box. Konva rotates a box about its
 * top-left corner, PowerPoint about its centre, so the box is placed where
 * Konva's rotated centre lands. `height` is the laid-out text height in px.
 */
export function pptTextBox(l: Extract<Layer, { kind: "text" }>, height: number) {
  const sx = Math.abs(l.scaleX);
  const sy = Math.abs(l.scaleY);
  const w = l.width * sx;
  const h = height * sy;
  const rad = (l.rotation * Math.PI) / 180;
  const cx = l.x + (w / 2) * Math.cos(rad) - (h / 2) * Math.sin(rad);
  const cy = l.y + (w / 2) * Math.sin(rad) + (h / 2) * Math.cos(rad);
  const inch = (px: number) => px / PX_PER_INCH;
  const pt = (px: number) => (px * 72) / PX_PER_INCH;
  const color = (l.fill.type === "solid" ? l.fill.color : l.fill.from).slice(1).toUpperCase();

  return {
    x: inch(cx - w / 2),
    y: inch(cy - h / 2),
    w: inch(w),
    h: inch(h),
    rotate: ((l.rotation % 360) + 360) % 360,
    fontFace: l.fontFamily,
    fontSize: Math.round(pt(l.fontSize * sy) * 10) / 10,
    bold: l.fontStyle.includes("bold"),
    italic: l.fontStyle.includes("italic"),
    color,
    align: l.align,
    valign: "top" as const,
    charSpacing: pt(l.letterSpacing * sx),
    lineSpacingMultiple: l.lineHeight,
    transparency: Math.round((1 - l.opacity) * 100),
    margin: 0,
    fit: "none" as const,
  };
}
