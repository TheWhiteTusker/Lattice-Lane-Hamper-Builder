"use client";

import type { RefObject } from "react";
import type Konva from "konva";
import { Group, Line, Rect, Transformer } from "react-konva";
import { ACCENT, STUDIO_COLORS } from "./konva-shapes";
import { CurveHandles, LineHandles } from "./line-handles";
import type { CanvasDoc } from "./use-canvas-doc";
import type { useDrawTool } from "./use-draw-tool";
import type { useLayerEvents } from "./use-layer-events";

/** Hover box, snap guides, draw preview, line handles and the Transformer. */
export function StageOverlays({
  doc,
  events,
  draw,
  trRef,
  ox,
  oy,
  zoom,
}: {
  doc: CanvasDoc;
  events: ReturnType<typeof useLayerEvents>;
  draw: ReturnType<typeof useDrawTool>;
  trRef: RefObject<Konva.Transformer | null>;
  ox: number;
  oy: number;
  zoom: number;
}) {
  const { canvas, selected, selection, selectedIds } = doc;
  const { hover, guides, marquee, setGuides } = events;
  const W = canvas.width;
  const H = canvas.height;
  const multi = selection.length > 1;
  const pageGroup = { x: ox, y: oy, scaleX: zoom, scaleY: zoom };
  const handles = { zoom, snapRightAngles: draw.snapRightAngles, setGuides, patch: doc.patch, ox, oy };
  const d = draw.drawing;
  const anchors =
    multi || selected?.kind === "image"
      ? ["top-left", "top-right", "bottom-left", "bottom-right"]
      : selected?.kind === "text"
        ? ["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right"]
        : undefined;

  return (
    <>
      {/* Overlays in page coordinates, drawn outside the clip and never exported. */}
      <Group {...pageGroup} listening={false}>
        {hover && !guides && !marquee && (
          <Rect {...hover} stroke={ACCENT} strokeWidth={1.5 / zoom} dash={[4 / zoom, 3 / zoom]} />
        )}
        {guides?.vertical.map((x) => (
          <Line key={`v${x}`} points={[x, -40 / zoom, x, H + 40 / zoom]} stroke={STUDIO_COLORS.guide} strokeWidth={1 / zoom} />
        ))}
        {guides?.horizontal.map((y) => (
          <Line key={`h${y}`} points={[-40 / zoom, y, W + 40 / zoom, y]} stroke={STUDIO_COLORS.guide} strokeWidth={1 / zoom} />
        ))}
      </Group>

      {/* Drawing preview (MS Paint style) */}
      {d && (
        <Group {...pageGroup} listening={false}>
          <Line
            points={
              d.tool === "curve"
                ? [
                    d.start.x,
                    d.start.y,
                    (d.start.x + d.current.x) / 2 - (d.current.y - d.start.y) * 0.2,
                    (d.start.y + d.current.y) / 2 + (d.current.x - d.start.x) * 0.2,
                    d.current.x,
                    d.current.y,
                  ]
                : [d.start.x, d.start.y, d.current.x, d.current.y]
            }
            bezier={d.tool === "curve"}
            stroke="#2c332f"
            strokeWidth={4 / zoom}
            lineCap="round"
          />
        </Group>
      )}

      {selected && !multi && !selected.locked && selected.kind === "line" && (
        <LineHandles layer={selected} {...handles} />
      )}
      {selected && !multi && !selected.locked && selected.kind === "curve" && (
        <CurveHandles layer={selected} {...handles} />
      )}

      <Transformer
        ref={trRef}
        rotateEnabled={!selected?.locked}
        resizeEnabled={!selected?.locked}
        keepRatio={multi || selected?.kind === "image" || selected?.kind === "text"}
        onTransformEnd={() => events.commitNodes(selectedIds)}
        enabledAnchors={anchors}
        flipEnabled={false}
        rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        rotationSnapTolerance={4}
        rotateAnchorOffset={28}
        anchorSize={10}
        anchorCornerRadius={5}
        anchorStroke={ACCENT}
        anchorStrokeWidth={1.5}
        anchorFill={STUDIO_COLORS.handleFill}
        borderStroke={selected?.locked ? STUDIO_COLORS.locked : ACCENT}
        borderStrokeWidth={1.5}
        boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8 ? oldBox : newBox)}
      />
    </>
  );
}
