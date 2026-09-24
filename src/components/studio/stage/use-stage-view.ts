import { useEffect, useState, type RefObject } from "react";
import { ZOOM_MAX, ZOOM_MIN } from "./konva-shapes";

export type StageView = ReturnType<typeof useStageView>;

/** Pasteboard size, zoom and pan. `ox`/`oy` are the page's top-left on the board. */
export function useStageView(boardRef: RefObject<HTMLDivElement | null>, W: number, H: number) {
  const [board, setBoard] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<{ zoom: number | null; panX: number; panY: number }>({ zoom: null, panX: 0, panY: 0 });

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoard({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [boardRef]);

  const fit = board.w ? Math.max(ZOOM_MIN, Math.min((board.w - 96) / W, (board.h - 96) / H)) : 0.3;
  const zoom = view.zoom ?? fit;
  const ox = (board.w - W * zoom) / 2 + view.panX;
  const oy = (board.h - H * zoom) / 2 + view.panY;

  /** Zoom keeping the page point under `anchor` (board coords) still. */
  const zoomTo = (next: (z: number) => number, anchor?: { x: number; y: number }) =>
    setView((v) => {
      const z = v.zoom ?? fit;
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next(z)));
      const ax = anchor?.x ?? board.w / 2;
      const ay = anchor?.y ?? board.h / 2;
      const px = (ax - ((board.w - W * z) / 2 + v.panX)) / z;
      const py = (ay - ((board.h - H * z) / 2 + v.panY)) / z;
      return {
        zoom: nz,
        panX: ax - px * nz - (board.w - W * nz) / 2,
        panY: ay - py * nz - (board.h - H * nz) / 2,
      };
    });
  const zoomFit = () => setView({ zoom: null, panX: 0, panY: 0 });
  const recenter = () => setView((v) => ({ zoom: v.zoom ?? fit, panX: 0, panY: 0 }));

  // Wheel: pan, or zoom at the cursor with Ctrl. Needs a non-passive listener.
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        zoomTo((z) => z * Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top });
      } else {
        setView((v) => ({ zoom: v.zoom ?? fit, panX: v.panX - e.deltaX, panY: v.panY - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  /** Space+drag or middle-drag pans, After Effects style. */
  function startPan(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    let last = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      const d = { x: ev.clientX - last.x, y: ev.clientY - last.y };
      last = { x: ev.clientX, y: ev.clientY };
      setView((v) => ({ zoom: v.zoom ?? fit, panX: v.panX + d.x, panY: v.panY + d.y }));
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  return { board, view, setView, fit, zoom, ox, oy, zoomTo, zoomFit, recenter, startPan };
}
