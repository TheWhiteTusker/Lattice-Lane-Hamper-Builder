"use client";

import type { RefObject } from "react";
import type Konva from "konva";
import { Group, Image as KImage, Layer as KLayer, Rect, Stage, Text } from "react-konva";
import { backgroundImageAttrs, fillProps, layerConfig } from "@/lib/hamper-canvas";
import { KONVA_SHAPES, LayerImage, STUDIO_COLORS, useImage } from "./konva-shapes";
import { StageOverlays } from "./stage-overlays";
import type { CanvasDoc } from "./use-canvas-doc";
import type { useDrawTool } from "./use-draw-tool";
import type { useLayerEvents } from "./use-layer-events";
import type { StageView } from "./use-stage-view";

/** The Konva stage: the page with its layers, and everything drawn over it. */
export function StageCanvas({
  doc,
  view,
  events,
  draw,
  stageRef,
  pageRef,
  trRef,
  spaceDown,
  fontTick,
}: {
  doc: CanvasDoc;
  view: StageView;
  events: ReturnType<typeof useLayerEvents>;
  draw: ReturnType<typeof useDrawTool>;
  stageRef: RefObject<Konva.Stage | null>;
  pageRef: RefObject<Konva.Group | null>;
  trRef: RefObject<Konva.Transformer | null>;
  spaceDown: boolean;
  fontTick: number;
}) {
  const { canvas } = doc;
  const { board, ox, oy, zoom } = view;
  const W = canvas.width;
  const H = canvas.height;
  const bgImage = useImage(canvas.background.image_url);

  return (
    <Stage
      ref={stageRef}
      width={board.w}
      height={board.h}
      onMouseDown={(e) => {
        if (draw.begin()) return;
        const name = e.target.name();
        const empty = e.target === e.target.getStage() || name === "bg" || name === "page-shadow";
        if (!empty || e.evt.button !== 0 || spaceDown) return;
        const additive = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
        if (!additive) doc.select(null);
        events.startMarquee(e.evt, additive);
      }}
      onMouseMove={(e) => draw.move(e.evt.shiftKey)}
      onMouseUp={draw.end}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        if (e.target === e.target.getStage() || e.target.name() === "bg") {
          doc.select(null);
          doc.setMenu({ x: e.evt.clientX, y: e.evt.clientY });
        }
      }}
    >
      <KLayer>
        <Rect
          name="page-shadow"
          x={ox}
          y={oy}
          width={W * zoom}
          height={H * zoom}
          fill="#ffffff"
          shadowColor={STUDIO_COLORS.pageShadow}
          shadowBlur={30}
          shadowOpacity={0.18}
          listening={false}
        />

        <Group ref={pageRef} x={ox} y={oy} scaleX={zoom} scaleY={zoom} clipX={0} clipY={0} clipWidth={W} clipHeight={H}>
          <Rect name="bg" width={W} height={H} {...fillProps(canvas.background.fill, W, H)} />
          {bgImage && <KImage image={bgImage} listening={false} {...backgroundImageAttrs(canvas, bgImage)} />}

          {canvas.layers.map((l) => {
            if (l.kind === "image") return <LayerImage key={l.id} layer={l} common={events.common(l)} />;
            const { shape, attrs } = layerConfig(l);
            if (l.kind === "text") {
              return (
                <Text
                  key={`${l.id}:${fontTick}`}
                  {...attrs}
                  {...events.common(l)}
                  onDblClick={() => !l.locked && doc.setEditingId(l.id)}
                  onDblTap={() => !l.locked && doc.setEditingId(l.id)}
                />
              );
            }
            const Shape = KONVA_SHAPES[shape as keyof typeof KONVA_SHAPES];
            const extraAttrs =
              l.kind === "line" || l.kind === "curve"
                ? { hitStrokeWidth: Math.max(32, (l.strokeWidth ?? 4) + 24, 24 / zoom) }
                : {};
            return <Shape key={l.id} {...attrs} {...extraAttrs} {...events.common(l)} />;
          })}
        </Group>

        <StageOverlays doc={doc} events={events} draw={draw} trRef={trRef} ox={ox} oy={oy} zoom={zoom} />
      </KLayer>
    </Stage>
  );
}
