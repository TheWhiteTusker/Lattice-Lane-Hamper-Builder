"use client";

import type Konva from "konva";
import { Circle, Group, Line } from "react-konva";
import { snapToRightAngle, type Layer } from "@/lib/hamper-canvas";
import { ACCENT, type Guides } from "./konva-shapes";
import { snapGuide } from "./use-draw-tool";

type LineLayer = Extract<Layer, { kind: "line" }>;
type CurveLayer = Extract<Layer, { kind: "curve" }>;
type HandleDrag = Konva.KonvaEventObject<globalThis.DragEvent>;

export type HandleProps = {
  zoom: number;
  snapRightAngles: boolean;
  setGuides: (g: Guides | null) => void;
  patch: (id: string, p: Partial<Layer>, group?: string | null) => void;
};

const handle = (zoom: number) => ({
  radius: 8 / zoom,
  hitStrokeWidth: 14 / zoom,
  fill: "#ffffff",
  stroke: ACCENT,
  strokeWidth: 2.5 / zoom,
  draggable: true,
});

/**
 * Snap a dragged handle to right angles around `origin`, pin the node there
 * and show the guide. `relative` rounds the offset from `origin` (an end
 * point stored relative to the start) rather than the page position.
 */
function dragSnapped(e: HandleDrag, origin: { x: number; y: number }, h: HandleProps, relative: boolean) {
  const s = snapToRightAngle(origin, { x: e.target.x(), y: e.target.y() }, {
    enabled: h.snapRightAngles,
    shiftKey: e.evt.shiftKey,
  });
  const rx = Math.round(relative ? s.x - origin.x : s.x);
  const ry = Math.round(relative ? s.y - origin.y : s.y);
  const x = relative ? origin.x + rx : rx;
  const y = relative ? origin.y + ry : ry;
  e.target.x(x);
  e.target.y(y);
  h.setGuides(snapGuide(s.snapped, origin));
  return { x, y, rx, ry };
}

/** Drag either end of a straight line. */
export function LineHandles({ layer: l, ox, oy, ...h }: HandleProps & { layer: LineLayer; ox: number; oy: number }) {
  const end = { x: l.x + l.points[2], y: l.y + l.points[3] };
  return (
    <Group x={ox} y={oy} scaleX={h.zoom} scaleY={h.zoom}>
      <Circle
        x={l.x + l.points[0]}
        y={l.y + l.points[1]}
        {...handle(h.zoom)}
        onDragMove={(e) => {
          const p = dragSnapped(e, end, h, false);
          h.patch(l.id, { x: p.x, y: p.y, points: [0, 0, end.x - p.x, end.y - p.y] }, "line-handle");
        }}
        onDragEnd={() => h.setGuides(null)}
      />
      <Circle
        x={end.x}
        y={end.y}
        {...handle(h.zoom)}
        onDragMove={(e) => {
          const p = dragSnapped(e, { x: l.x, y: l.y }, h, true);
          h.patch(l.id, { points: [0, 0, p.rx, p.ry] }, "line-handle");
        }}
        onDragEnd={() => h.setGuides(null)}
      />
    </Group>
  );
}

/** Drag either end of a curve, or its bend point. */
export function CurveHandles({ layer: l, ox, oy, ...h }: HandleProps & { layer: CurveLayer; ox: number; oy: number }) {
  const [, , bx, by, ex, ey] = l.points;
  return (
    <Group x={ox} y={oy} scaleX={h.zoom} scaleY={h.zoom}>
      <Line
        points={[l.x + l.points[0], l.y + l.points[1], l.x + bx, l.y + by, l.x + ex, l.y + ey]}
        stroke={ACCENT}
        strokeWidth={1.5 / h.zoom}
        dash={[4 / h.zoom, 4 / h.zoom]}
        listening={false}
      />
      <Circle
        x={l.x + l.points[0]}
        y={l.y + l.points[1]}
        {...handle(h.zoom)}
        onDragMove={(e) => {
          const p = dragSnapped(e, { x: l.x + (ex ?? 300), y: l.y + (ey ?? 0) }, h, false);
          const dx = p.x - l.x;
          const dy = p.y - l.y;
          h.patch(l.id, { x: p.x, y: p.y, points: [0, 0, bx - dx, by - dy, ex - dx, ey - dy] }, "curve-handle");
        }}
        onDragEnd={() => h.setGuides(null)}
      />
      <Circle
        x={l.x + bx}
        y={l.y + by}
        {...handle(h.zoom)}
        radius={9.5 / h.zoom}
        fill={ACCENT}
        stroke="#ffffff"
        onDragMove={(e) => {
          // Curvature is how far the bend sits off the line's middle, relative to its length.
          const ncx = Math.round(e.target.x() - l.x);
          const ncy = Math.round(e.target.y() - l.y);
          const endX = ex ?? 300;
          const endY = ey ?? 0;
          const len = Math.hypot(endX, endY) || 1;
          const proj = (ncx - endX / 2) * (-endY / len) + (ncy - endY / 2) * (endX / len);
          const curvature = Number(((proj * 2) / len).toFixed(2));
          h.patch(l.id, { curvature, points: [0, 0, ncx, ncy, ex, ey] }, "curve-handle");
        }}
      />
      <Circle
        x={l.x + ex}
        y={l.y + ey}
        {...handle(h.zoom)}
        onDragMove={(e) => {
          const p = dragSnapped(e, { x: l.x, y: l.y }, h, true);
          h.patch(l.id, { points: [0, 0, bx, by, p.rx, p.ry] }, "curve-handle");
        }}
        onDragEnd={() => h.setGuides(null)}
      />
    </Group>
  );
}
