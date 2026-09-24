import { useState, type RefObject } from "react";
import type Konva from "konva";
import { snapToRightAngle, type Layer } from "@/lib/hamper-canvas";
import { baseLayer } from "../editor";
import type { Guides } from "./konva-shapes";

type Point = { x: number; y: number };
export type Drawing = { start: Point; current: Point; tool: "line" | "curve" };

/** Guide through `origin` along the axis a point snapped to. */
export const snapGuide = (snapped: string | null, origin: Point): Guides | null =>
  snapped === "horizontal"
    ? { vertical: [], horizontal: [origin.y] }
    : snapped === "vertical"
      ? { vertical: [origin.x], horizontal: [] }
      : null;

export type Tool = "select" | "line" | "curve";

/** The line / curve tools: press, drag and release on the page draws one. */
export function useDrawTool({
  pageRef,
  setGuides,
  add,
  activeTool,
  setActiveTool,
}: {
  pageRef: RefObject<Konva.Group | null>;
  setGuides: (g: Guides | null) => void;
  add: (layer: Layer) => void;
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
}) {
  const [snapRightAngles, setSnapRightAngles] = useState(true);
  const [drawing, setDrawing] = useState<Drawing | null>(null);

  /** Starts a drawing if a drawing tool is active; true when it took the press. */
  function begin() {
    if (activeTool === "select") return false;
    const pos = pageRef.current?.getRelativePointerPosition();
    if (pos) setDrawing({ start: pos, current: pos, tool: activeTool });
    return true;
  }

  function move(shiftKey: boolean) {
    const pos = drawing && pageRef.current?.getRelativePointerPosition();
    if (!drawing || !pos) return;
    const snapped = snapToRightAngle(drawing.start, pos, { enabled: snapRightAngles, shiftKey });
    setDrawing((s) => (s ? { ...s, current: { x: snapped.x, y: snapped.y } } : null));
    setGuides(snapGuide(snapped.snapped, drawing.start));
  }

  function end() {
    setGuides(null);
    if (!drawing) return;
    const dx = drawing.current.x - drawing.start.x;
    const dy = drawing.current.y - drawing.start.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= 8) {
      const at = baseLayer(Math.round(drawing.start.x), Math.round(drawing.start.y));
      const stroke = { stroke: "#2c332f", strokeWidth: 4, lineCap: "round" as const };
      if (drawing.tool === "line") {
        add({ ...at, ...stroke, kind: "line", points: [0, 0, Math.round(dx), Math.round(dy)] });
      } else {
        // Bend the control point off the middle, perpendicular to the line.
        const offset = (dist * 0.4) / 2;
        const cx = dx / 2 + (-dy / dist) * offset;
        const cy = dy / 2 + (dx / dist) * offset;
        add({
          ...at,
          ...stroke,
          kind: "curve",
          points: [0, 0, Math.round(cx), Math.round(cy), Math.round(dx), Math.round(dy)],
          curvature: 0.4,
        });
      }
    }
    setDrawing(null);
    setActiveTool("select");
  }

  return { snapRightAngles, setSnapRightAngles, drawing, begin, move, end };
}
