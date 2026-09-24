import { useEffect, useRef, useState, type RefObject } from "react";
import type Konva from "konva";
import { boundsOf, intersects, snap, type Box, type Layer } from "@/lib/hamper-canvas";
import type { Guides } from "./konva-shapes";
import type { CanvasDoc } from "./use-canvas-doc";

/**
 * The props every drawn layer gets (select, drag with snapping, transform),
 * plus marquee selection and keeping the Transformer on the selection.
 */
export function useLayerEvents({
  doc,
  nodes,
  pageRef,
  trRef,
  boardRef,
  zoom,
  spaceDown,
  selecting,
  fontTick,
}: {
  doc: CanvasDoc;
  nodes: RefObject<Map<string, Konva.Node>>;
  pageRef: RefObject<Konva.Group | null>;
  trRef: RefObject<Konva.Transformer | null>;
  boardRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  spaceDown: boolean;
  /** The select tool is active (not drawing a line or curve). */
  selecting: boolean;
  fontTick: number;
}) {
  const { canvas, selectedIds, selected, editingId, select, selectMany, toggleSelect, setLayers } = doc;
  const [guides, setGuides] = useState<Guides | null>(null);
  const [hover, setHover] = useState<Box | null>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);
  /** The layer the pointer is dragging; the rest of the selection follows it. */
  const dragLead = useRef<string | null>(null);

  useEffect(() => {
    // A lone locked layer still shows its box; in a group, locked layers stay out so they don't move.
    // Single line or curve uses direct endpoint/bend handles instead of a box transformer.
    const isSingleLine = selectedIds.length === 1 && (selected?.kind === "line" || selected?.kind === "curve");
    const attach = editingId || isSingleLine
      ? []
      : canvas.layers
          .filter((l) => selectedIds.includes(l.id) && l.visible && (selectedIds.length === 1 || !l.locked))
          .flatMap((l) => nodes.current.get(l.id) ?? []);
    trRef.current?.nodes(attach);
    trRef.current?.getLayer()?.batchDraw();
  }, [selectedIds, editingId, canvas.layers, fontTick, zoom, selected, nodes, trRef]);

  /** Write nodes' on-screen position/rotation/scale back to the document, as one undo step. */
  const commitNodes = (ids: string[]) =>
    setLayers((ls) =>
      ls.map((l) => {
        const n = ids.includes(l.id) ? nodes.current.get(l.id) : undefined;
        if (!n) return l;
        return {
          ...l,
          x: n.x(),
          y: n.y(),
          rotation: n.rotation(),
          scaleX: n.scaleX(),
          scaleY: n.scaleY(),
          ...(l.kind === "text" ? { width: n.width() } : {}),
        } as Layer;
      }),
    );

  /** Rubber-band selection from a press on empty page or pasteboard. */
  function startMarquee(evt: MouseEvent, additive: boolean) {
    const el = boardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const start = { x: evt.clientX - r.left, y: evt.clientY - r.top };
    const keep = additive ? selectedIds : [];
    let box: Box | null = null;
    const move = (ev: PointerEvent) => {
      const x = ev.clientX - r.left;
      const y = ev.clientY - r.top;
      box = { x: Math.min(start.x, x), y: Math.min(start.y, y), width: Math.abs(x - start.x), height: Math.abs(y - start.y) };
      setMarquee(box);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setMarquee(null);
      const area = box as Box | null;
      if (!area || (area.width < 4 && area.height < 4)) return;
      // Stage coordinates are board coordinates: the stage fills the board at 0,0.
      const hit = canvas.layers
        .filter((l) => {
          const n = nodes.current.get(l.id);
          return l.visible && !l.locked && n && intersects(n.getClientRect(), area);
        })
        .map((l) => l.id);
      selectMany([...new Set([...keep, ...hit])]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const register = (id: string) => (node: Konva.Node | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  };

  const common = (l: Layer) => ({
    ref: register(l.id),
    x: l.x,
    y: l.y,
    rotation: l.rotation,
    scaleX: l.scaleX,
    scaleY: l.scaleY,
    opacity: l.opacity,
    visible: l.visible && editingId !== l.id,
    draggable: !l.locked && !spaceDown && selecting,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!selecting || e.evt.button !== 0 || spaceDown) return;
      if (e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey) toggleSelect(l.id);
      // Pressing on part of a selection keeps it, so the whole group can be dragged.
      else if (!selectedIds.includes(l.id)) select(l.id);
    },
    onTap: () => selecting && select(l.id),
    onContextMenu: (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      if (!selectedIds.includes(l.id)) select(l.id);
      doc.setMenu({ x: e.evt.clientX, y: e.evt.clientY });
    },
    onMouseEnter: (e: Konva.KonvaEventObject<MouseEvent>) => {
      const page = pageRef.current;
      if (page && !selectedIds.includes(l.id)) setHover(e.target.getClientRect({ relativeTo: page }));
    },
    onMouseLeave: () => setHover(null),
    onDragStart: () => {
      // The Transformer starts dragging the rest of the selection too; only the first counts.
      dragLead.current ??= l.id;
      setHover(null);
    },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      if (dragLead.current !== l.id) return;
      const page = pageRef.current;
      if (!page || e.evt.altKey) return setGuides(null);
      // Snap the selection's combined box, then move every selected node by the same amount.
      const moving = selectedIds.includes(l.id) ? selectedIds : [l.id];
      const movingNodes = moving.flatMap((id) => nodes.current.get(id) ?? []);
      const others = canvas.layers
        .filter((o) => !moving.includes(o.id) && o.visible)
        .flatMap((o) => nodes.current.get(o.id)?.getClientRect({ relativeTo: page }) ?? []);
      const s = snap(boundsOf(movingNodes.map((n) => n.getClientRect({ relativeTo: page }))), others, canvas, 6 / zoom);
      for (const n of movingNodes) {
        n.x(n.x() + s.dx);
        n.y(n.y() + s.dy);
      }
      setGuides((g) =>
        g && g.vertical[0] === s.vertical[0] && g.horizontal[0] === s.horizontal[0]
          ? g
          : { vertical: s.vertical, horizontal: s.horizontal },
      );
    },
    onDragEnd: () => {
      if (dragLead.current !== l.id) return;
      dragLead.current = null;
      setGuides(null);
      commitNodes(selectedIds.includes(l.id) ? selectedIds : [l.id]);
    },
    onTransform: (e: Konva.KonvaEventObject<Event>) => {
      if (l.kind !== "text" || selectedIds.length > 1) return;
      // Side handles change a text box's width (re-wrapping); corners scale it.
      const anchor = trRef.current?.getActiveAnchor();
      if (anchor === "middle-left" || anchor === "middle-right") {
        const n = e.target as Konva.Text;
        n.width(Math.max(30, (n.width() * n.scaleX()) / n.scaleY()));
        n.scaleX(n.scaleY());
      }
    },
  });

  return { guides, setGuides, hover, marquee, common, commitNodes, startMarquee };
}
