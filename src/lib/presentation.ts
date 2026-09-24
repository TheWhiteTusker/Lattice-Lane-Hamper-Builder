import type { Layer } from "./hamper-canvas.ts";

/*
 * Presentation decks in the house format ("Premium Gift Hamper Deck 2026"):
 * a green entry slide, one white slide per hamper or product with the photos
 * standing on a green band, and a green thank-you slide. Every slide is an
 * ordinary designer canvas, so the photo editor edits them afterwards.
 *
 * The layout needs each photo's real proportions, so slides are generated in
 * the browser once the images have loaded (see presentations/build-slides.ts).
 */

export * from "./deck-types.ts";
export { splitTitle, formatInr } from "./deck-layers.ts";
export { arrangeRow } from "./deck-row.ts";
export * from "./deck-slides.ts";

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
    underline: l.textDecoration === "underline" ? { style: "sng" as const } : undefined,
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
