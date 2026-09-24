/** Konva props for drawing a canvas layer. Re-exported from hamper-canvas.ts. */

import type { Fill, Layer } from "./hamper-canvas.ts";

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

type ImageSize = { naturalWidth: number; naturalHeight: number };

export type KonvaShape = "Image" | "Text" | "Rect" | "Ellipse" | "RegularPolygon" | "Star" | "Line";

/**
 * The Konva class and attributes that draw a layer. Shared by the editor, the
 * slide thumbnails and the exporters so all three draw a layer identically.
 * Images pass their loaded element's natural size (needed for "contain").
 */
export function layerConfig(l: Layer, img?: ImageSize): { shape: KonvaShape; attrs: Record<string, unknown> } {
  const common = {
    x: l.x,
    y: l.y,
    rotation: l.rotation,
    scaleX: l.scaleX,
    scaleY: l.scaleY,
    opacity: l.opacity,
    visible: l.visible,
  };
  const stroke = "stroke" in l ? { stroke: l.stroke, strokeWidth: l.strokeWidth } : {};

  switch (l.kind) {
    case "image": {
      if (l.fit !== "contain" || !img) return { shape: "Image", attrs: { ...common, width: l.width, height: l.height } };
      const k = Math.min(l.width / img.naturalWidth, l.height / img.naturalHeight);
      const w = img.naturalWidth * k;
      const h = img.naturalHeight * k;
      // Centre inside the frame; offsets are local, so rotation and scale still pivot on the frame corner.
      return {
        shape: "Image",
        attrs: { ...common, width: w, height: h, offsetX: -(l.width - w) / 2, offsetY: -(l.height - h) / 2 },
      };
    }
    case "text":
      return {
        shape: "Text",
        attrs: {
          ...common,
          text: l.text,
          fontSize: l.fontSize,
          fontFamily: l.fontFamily,
          fontStyle: l.fontStyle,
          align: l.align,
          width: l.width,
          letterSpacing: l.letterSpacing,
          lineHeight: l.lineHeight,
          textDecoration: l.textDecoration === "underline" ? "underline" : "",
          ...fillProps(l.fill, l.width, l.fontSize * l.lineHeight * l.text.split("\n").length),
        },
      };
    case "rect":
      return {
        shape: "Rect",
        attrs: { ...common, ...stroke, width: l.width, height: l.height, cornerRadius: l.cornerRadius, ...fillProps(l.fill, l.width, l.height) },
      };
    case "ellipse":
      return {
        shape: "Ellipse",
        attrs: {
          ...common,
          ...stroke,
          radiusX: l.radiusX,
          radiusY: l.radiusY,
          ...fillProps(l.fill, l.radiusX * 2, l.radiusY * 2, -l.radiusX, -l.radiusY),
        },
      };
    case "polygon":
      return {
        shape: "RegularPolygon",
        attrs: { ...common, ...stroke, sides: l.sides, radius: l.radius, ...fillProps(l.fill, l.radius * 2, l.radius * 2, -l.radius, -l.radius) },
      };
    case "star":
      return {
        shape: "Star",
        attrs: {
          ...common,
          ...stroke,
          numPoints: l.numPoints,
          innerRadius: l.innerRadius,
          outerRadius: l.outerRadius,
          ...fillProps(l.fill, l.outerRadius * 2, l.outerRadius * 2, -l.outerRadius, -l.outerRadius),
        },
      };
    case "line":
      return {
        shape: "Line",
        attrs: {
          ...common,
          points: l.points,
          stroke: l.stroke,
          strokeWidth: l.strokeWidth,
          hitStrokeWidth: Math.max(28, l.strokeWidth + 20),
          lineCap: l.lineCap ?? "round",
          lineJoin: "round",
          ...(l.dash && l.dash.length ? { dash: l.dash } : {}),
        },
      };
    case "curve":
      return {
        shape: "Line",
        attrs: {
          ...common,
          points: l.points,
          bezier: true,
          stroke: l.stroke,
          strokeWidth: l.strokeWidth,
          hitStrokeWidth: Math.max(28, l.strokeWidth + 20),
          lineCap: l.lineCap ?? "round",
          lineJoin: "round",
          ...(l.dash && l.dash.length ? { dash: l.dash } : {}),
        },
      };
  }
}

/** A background image scaled to cover the whole page, centred. */
export function backgroundImageAttrs(page: { width: number; height: number }, img: ImageSize) {
  const k = Math.max(page.width / img.naturalWidth, page.height / img.naturalHeight);
  return {
    width: img.naturalWidth * k,
    height: img.naturalHeight * k,
    x: (page.width - img.naturalWidth * k) / 2,
    y: (page.height - img.naturalHeight * k) / 2,
  };
}
