import { useEffect } from "react";
import { redo, undo, type LayerMove } from "@/lib/hamper-canvas";
import type { CanvasDoc } from "./use-canvas-doc";
import type { StageView } from "./use-stage-view";

/** Keyboard shortcuts (see SHORTCUTS in stage-footer.tsx). */
export function useStageKeys({
  doc,
  view,
  save,
  move,
  swapId,
  setSwapId,
  setSpaceDown,
}: {
  doc: CanvasDoc;
  view: StageView;
  save: () => void;
  move: (ids: string[], m: LayerMove) => void;
  swapId: string | null;
  setSwapId: (id: string | null) => void;
  setSpaceDown: (down: boolean) => void;
}) {
  useEffect(() => {
    const { selection, selectedIds, selected, clipboard, menu } = doc;
    const onDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (typing) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) setSpaceDown(true);
        return;
      }
      if (mod && key === "z") {
        e.preventDefault();
        doc.setHist(e.shiftKey ? redo : undo);
      } else if (mod && key === "y") {
        e.preventDefault();
        doc.setHist(redo);
      } else if (mod && key === "a") {
        e.preventDefault();
        doc.selectAll();
      } else if (mod && key === "c" && selection.length) {
        doc.setClipboard(selection);
      } else if (mod && key === "v" && clipboard.length) {
        e.preventDefault();
        doc.paste();
      } else if (mod && key === "d" && selection.length) {
        e.preventDefault();
        doc.duplicate(selectedIds);
      } else if (mod && (e.code === "BracketRight" || e.code === "BracketLeft") && selection.length) {
        e.preventDefault();
        const up = e.code === "BracketRight";
        move(selectedIds, e.shiftKey ? (up ? "front" : "back") : up ? "forward" : "backward");
      } else if (mod && key === "0") {
        e.preventDefault();
        view.zoomFit();
      } else if (mod && (key === "=" || key === "+")) {
        e.preventDefault();
        view.zoomTo((z) => z * 1.25);
      } else if (mod && key === "-") {
        e.preventDefault();
        view.zoomTo((z) => z / 1.25);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selection.length) {
        e.preventDefault();
        doc.remove(selectedIds);
      } else if (e.key.startsWith("Arrow") && selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const ids = selection.filter((l) => !l.locked).map((l) => l.id);
        doc.shift(new Map(ids.map((id) => [id, { dx, dy }])), `nudge:${ids.join()}`);
      } else if (e.key === "Enter" && selected?.kind === "text" && !selected.locked) {
        e.preventDefault();
        doc.setEditingId(selected.id);
      } else if (e.key === "Escape") {
        if (menu) doc.setMenu(null);
        else if (swapId) setSwapId(null);
        else doc.select(null);
      }
    };
    const onUp = (e: KeyboardEvent) => e.code === "Space" && setSpaceDown(false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  });

  // A click anywhere closes the context menu.
  const { menu, setMenu } = doc;
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu, setMenu]);
}
