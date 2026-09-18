"use client";

import { useState } from "react";
import { Eye, EyeOff, GripVertical, Layers, Link2, Lock, LockOpen, Unlink2 } from "lucide-react";
import { fillCss, layerLabel, type Layer } from "@/lib/hamper-canvas";
import type { Editor } from "./editor";
import { cx, panelTitle, ScrubNumber, ToolButton } from "./studio-ui";

/** The unscaled box size of a layer, which scaleX/scaleY multiply. */
function baseSize(l: Layer) {
  switch (l.kind) {
    case "image":
    case "rect":
      return { w: l.width, h: l.height };
    case "text":
      return { w: l.width, h: l.fontSize * l.lineHeight * Math.max(1, l.text.split("\n").length) };
    case "ellipse":
      return { w: l.radiusX * 2, h: l.radiusY * 2 };
    case "polygon":
      return { w: l.radius * 2, h: l.radius * 2 };
    case "star":
      return { w: l.outerRadius * 2, h: l.outerRadius * 2 };
    case "line":
    case "curve": {
      const xs = l.points.filter((_, i) => i % 2 === 0);
      const ys = l.points.filter((_, i) => i % 2 === 1);
      return {
        w: Math.max(20, Math.max(...xs) - Math.min(...xs)),
        h: Math.max(20, Math.max(...ys) - Math.min(...ys)),
      };
    }
  }
}

function Thumb({ l }: { l: Layer }) {
  const box = "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-[var(--st-line)]";
  if (l.kind === "image") {
    return (
      <span className={cx(box, "checkerboard")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={l.url} alt="" className="h-full w-full object-contain" />
      </span>
    );
  }
  if (l.kind === "text") {
    return (
      <span className={cx(box, "bg-[var(--st-panel-2)] text-[15px] font-semibold")} style={{ fontFamily: l.fontFamily }}>
        T
      </span>
    );
  }
  if (l.kind === "line" || l.kind === "curve") {
    return (
      <span className={cx(box, "bg-[var(--st-panel-2)]")}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" stroke={l.stroke} strokeWidth="2.5" fill="none" strokeLinecap="round">
          {l.kind === "line" ? (
            <line x1="4" y1="20" x2="20" y2="4" strokeDasharray={l.dash?.length ? "4 3" : undefined} />
          ) : (
            <path d="M4 18 C8 6, 16 6, 20 18" strokeDasharray={l.dash?.length ? "4 3" : undefined} />
          )}
        </svg>
      </span>
    );
  }
  return (
    <span className={cx(box, "bg-[var(--st-panel-2)]")}>
      <span
        className={cx("h-5 w-5", l.kind === "ellipse" && "rounded-full", l.kind === "rect" && l.cornerRadius > 0 && "rounded")}
        style={{
          background: fillCss(l.fill),
          clipPath:
            l.kind === "polygon" && l.sides === 3
              ? "polygon(50% 0, 100% 100%, 0 100%)"
              : l.kind === "star"
                ? "polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)"
                : l.kind === "polygon"
                  ? "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)"
                  : undefined,
        }}
      />
    </span>
  );
}

export function LayersPanel({ ed }: { ed: Editor }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const layers = ed.canvas.layers;
  // Top of the list = top of the stack, as in After Effects and Canva.
  const shown = [...layers].reverse();

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--st-line)] px-3">
        <Layers className="h-4 w-4 text-[var(--st-muted)]" />
        <span className="font-semibold">Layers</span>
        <span className="ml-auto text-[11px] text-[var(--st-muted)]">{layers.length}</span>
      </header>

      <ul className="min-h-0 flex-1 overflow-y-auto py-1" onDragLeave={() => setOverId(null)}>
        {shown.length === 0 && (
          <li className="px-3 py-6 text-center text-[12px] text-[var(--st-muted)]">
            Nothing here yet. Add products, text or shapes from the left.
          </li>
        )}
        {shown.map((l) => {
          const selected = ed.selectedIds.includes(l.id);
          return (
            <li
              key={l.id}
              draggable={renaming !== l.id}
              onDragStart={(e) => {
                setDragId(l.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverId(l.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) ed.reorder(dragId, layers.findIndex((x) => x.id === l.id));
                setDragId(null);
                setOverId(null);
              }}
              onClick={(e) => {
                if (e.shiftKey && ed.selectedIds.length) {
                  // Range from the last-picked layer to this one, in stacking order.
                  const anchor = layers.findIndex((x) => x.id === ed.selectedIds[ed.selectedIds.length - 1]);
                  const here = layers.findIndex((x) => x.id === l.id);
                  const [a, b] = anchor < here ? [anchor, here] : [here, anchor];
                  ed.selectMany(layers.slice(a, b + 1).map((x) => x.id));
                } else if (e.ctrlKey || e.metaKey) {
                  ed.toggleSelect(l.id);
                } else {
                  ed.select(l.id);
                }
              }}
              className={cx(
                "group mx-1 flex cursor-default items-center gap-2 rounded-md border-t-2 border-transparent px-1.5 py-1",
                selected ? "bg-[var(--st-accent-soft)]" : "hover:bg-[var(--st-hover)]",
                overId === l.id && dragId !== l.id && "border-t-[var(--st-accent)]",
                dragId === l.id && "opacity-40",
                !l.visible && "opacity-50",
              )}
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[var(--st-muted)] opacity-0 group-hover:opacity-100" />
              <Thumb l={l} />
              {renaming === l.id ? (
                <input
                  autoFocus
                  defaultValue={layerLabel(l)}
                  className="h-6 min-w-0 flex-1 rounded border border-[var(--st-accent)] bg-[var(--st-panel-2)] px-1 text-[12px] outline-none"
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    ed.patch(l.id, { name: e.target.value.trim() || undefined });
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <span
                  className="min-w-0 flex-1 truncate text-[12.5px]"
                  title="Double-click to rename"
                  onDoubleClick={() => setRenaming(l.id)}
                >
                  {layerLabel(l)}
                </span>
              )}
              <ToolButton
                title={l.locked ? "Unlock" : "Lock"}
                className={cx("h-6 w-6 px-0", !l.locked && "opacity-0 group-hover:opacity-100")}
                onClick={(e) => {
                  e.stopPropagation();
                  ed.patch(l.id, { locked: !l.locked });
                }}
              >
                {l.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
              </ToolButton>
              <ToolButton
                title={l.visible ? "Hide" : "Show"}
                className={cx("h-6 w-6 px-0", l.visible && "opacity-0 group-hover:opacity-100")}
                onClick={(e) => {
                  e.stopPropagation();
                  ed.patch(l.id, { visible: !l.visible });
                }}
              >
                {l.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </ToolButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function TransformPanel({ ed }: { ed: Editor }) {
  const [linked, setLinked] = useState(true);
  const l = ed.selected;

  return (
    <section className="shrink-0 border-t border-[var(--st-line)] p-3">
      <div className={cx(panelTitle, "mb-2")}>Transform</div>
      {ed.selection.length > 1 ? (
        <p className="text-[12px] text-[var(--st-muted)]">
          {ed.selection.length} layers selected. Drag any of them to move them together, or use Align in the toolbar.
        </p>
      ) : !l ? (
        <p className="text-[12px] text-[var(--st-muted)]">
          Select a layer to see its position and size. Shift-click for a range, Ctrl-click to add one.
        </p>
      ) : (
        (() => {
          const { w, h } = baseSize(l);
          const W = w * Math.abs(l.scaleX);
          const H = h * Math.abs(l.scaleY);
          const off = l.locked;
          const setW = (v: number) => {
            const sx = Math.max(1, v) / w;
            const ratio = sx / Math.abs(l.scaleX);
            ed.tweak(l.id, {
              scaleX: Math.sign(l.scaleX) * sx,
              ...(linked ? { scaleY: l.scaleY * ratio } : {}),
            });
          };
          const setH = (v: number) => {
            const sy = Math.max(1, v) / h;
            const ratio = sy / Math.abs(l.scaleY);
            ed.tweak(l.id, {
              scaleY: Math.sign(l.scaleY) * sy,
              ...(linked ? { scaleX: l.scaleX * ratio } : {}),
            });
          };
          return (
            <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-x-2 gap-y-1">
              <ScrubNumber label="X" value={l.x} disabled={off} onChange={(x) => ed.tweak(l.id, { x })} />
              <ScrubNumber label="Y" value={l.y} disabled={off} onChange={(y) => ed.tweak(l.id, { y })} />
              <span />
              <ScrubNumber label="W" value={W} min={1} disabled={off} onChange={setW} />
              <ScrubNumber label="H" value={H} min={1} disabled={off} onChange={setH} />
              <ToolButton
                title={linked ? "Unlink width and height" : "Link width and height"}
                active={linked}
                className="h-6 w-6 px-0"
                onClick={() => setLinked((v) => !v)}
              >
                {linked ? <Link2 className="h-3.5 w-3.5" /> : <Unlink2 className="h-3.5 w-3.5" />}
              </ToolButton>
              <ScrubNumber
                label="↻"
                value={l.rotation}
                suffix="°"
                disabled={off}
                onChange={(rotation) => ed.tweak(l.id, { rotation: ((rotation % 360) + 360) % 360 })}
              />
              <ScrubNumber
                label="◐"
                value={l.opacity * 100}
                min={0}
                max={100}
                suffix="%"
                onChange={(v) => ed.tweak(l.id, { opacity: v / 100 })}
              />
            </div>
          );
        })()
      )}
    </section>
  );
}
