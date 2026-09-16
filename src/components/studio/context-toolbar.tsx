"use client";

import { useState } from "react";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowUp,
  Blend,
  Bold,
  BringToFront,
  Columns3,
  Copy,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Italic,
  Underline,
  Lock,
  LockOpen,
  Maximize2,
  Minus,
  Plus,
  Replace,
  Rows3,
  Scissors,
  SendToBack,
  Trash2,
} from "lucide-react";
import type { Layer, LayerMove, PageAlign } from "@/lib/hamper-canvas";
import type { Editor } from "./editor";
import {
  ColorButton,
  Divider,
  FontPicker,
  PageSizeInputs,
  Popover,
  Slider,
  ToolButton,
  accentBtn,
  cx,
  panelTitle,
} from "./studio-ui";

const icon = "h-4 w-4";

export function ContextToolbar({ ed }: { ed: Editor }) {
  const l = ed.selected;

  return (
    <div className="flex min-h-12 flex-wrap items-center gap-1 border-b border-[var(--st-line)] bg-[var(--st-panel)] px-3 py-1.5">
      {ed.selection.length > 1 ? <MultiTools ed={ed} /> : !l ? <PageTools ed={ed} /> : <LayerTools ed={ed} l={l} />}
    </div>
  );
}

function PageTools({ ed }: { ed: Editor }) {
  const bg = ed.canvas.background;
  return (
    <>
      <span className="mr-1 text-[12px] text-[var(--st-muted)]">Page size</span>
      <PageSizeInputs
        width={ed.canvas.width}
        height={ed.canvas.height}
        onChange={(width, height) => ed.change((c) => ({ ...c, width, height }))}
      />
      <Divider />
      <ColorButton
        title="Background colour"
        fill={bg.fill}
        documentColors={ed.documentColors}
        onChange={(fill) => ed.change((c) => ({ ...c, background: { ...c.background, fill } }), "bg-fill")}
      />
      <label className={cx("inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 hover:bg-[var(--st-hover)]")}>
        <ImagePlus className={icon} />
        {bg.image_url ? "Replace background image" : "Background image"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) ed.uploadBackground(f);
            e.target.value = "";
          }}
        />
      </label>
      {bg.image_url && (
        <ToolButton
          title="Remove background image"
          onClick={() => ed.change((c) => ({ ...c, background: { ...c.background, image_url: null } }))}
        >
          <Trash2 className={icon} />
        </ToolButton>
      )}
      <span className="ml-auto text-[12px] text-[var(--st-muted)]">
        Click to select · Shift+click or drag a box to select several · right-click for more
      </span>
    </>
  );
}

function LayerTools({ ed, l }: { ed: Editor; l: Layer }) {
  const locked = l.locked;

  return (
    <>
      {!locked && l.kind === "text" && <TextTools ed={ed} l={l} />}
      {!locked && (l.kind === "rect" || l.kind === "ellipse" || l.kind === "polygon" || l.kind === "star") && (
        <ShapeTools ed={ed} l={l} />
      )}
      {!locked && l.kind === "image" && <ImageTools ed={ed} l={l} />}
      {locked && <span className="text-[12px] text-[var(--st-muted)]">This element is locked.</span>}

      <div className="ml-auto flex items-center gap-1">
        {!locked && <PositionMenu ed={ed} ids={[l.id]} />}
        <Popover title="Transparency" align="right" width={220} trigger={<Blend className={icon} />}>
          <Slider
            label="Transparency"
            value={Math.round(l.opacity * 100)}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => ed.tweak(l.id, { opacity: v / 100 })}
          />
        </Popover>
        <ToolButton title={locked ? "Unlock" : "Lock"} active={locked} onClick={() => ed.patch(l.id, { locked: !locked })}>
          {locked ? <Lock className={icon} /> : <LockOpen className={icon} />}
        </ToolButton>
        <ToolButton title="Duplicate (Ctrl+D)" onClick={() => ed.duplicate([l.id])}>
          <Copy className={icon} />
        </ToolButton>
        <ToolButton title="Delete (Del)" onClick={() => ed.remove([l.id])}>
          <Trash2 className={icon} />
        </ToolButton>
      </div>
    </>
  );
}

function MultiTools({ ed }: { ed: Editor }) {
  const ids = ed.selectedIds;
  const n = ed.selection.length;
  const allLocked = ed.selection.every((l) => l.locked);
  const opacity = Math.round((ed.selection[0]?.opacity ?? 1) * 100);

  return (
    <>
      <span className="mr-2 rounded-md bg-[var(--st-accent-soft)] px-2 py-1 text-[12px]">{n} elements selected</span>
      <AlignMenu ed={ed} ids={ids} />
      <button type="button" className="ml-1 text-[12px] text-[var(--st-muted)] underline hover:text-[var(--st-text)]" onClick={() => ed.select(null)}>
        Clear selection
      </button>

      <div className="ml-auto flex items-center gap-1">
        <PositionMenu ed={ed} ids={ids} />
        <Popover title="Transparency" align="right" width={220} trigger={<Blend className={icon} />}>
          <Slider
            label="Transparency (all)"
            value={opacity}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => ed.patchEach(ids, { opacity: v / 100 }, `opacity:${ids.join()}`)}
          />
        </Popover>
        <ToolButton title={allLocked ? "Unlock all" : "Lock all"} active={allLocked} onClick={() => ed.patchEach(ids, { locked: !allLocked })}>
          {allLocked ? <Lock className={icon} /> : <LockOpen className={icon} />}
        </ToolButton>
        <ToolButton title="Duplicate all (Ctrl+D)" onClick={() => ed.duplicate(ids)}>
          <Copy className={icon} />
        </ToolButton>
        <ToolButton title="Delete all (Del)" onClick={() => ed.remove(ids)}>
          <Trash2 className={icon} />
        </ToolButton>
      </div>
    </>
  );
}

/** Align several elements to each other, or space them evenly. */
function AlignMenu({ ed, ids }: { ed: Editor; ids: string[] }) {
  const aligns: [PageAlign, string, typeof ArrowUp][] = [
    ["left", "Left", AlignStartVertical],
    ["top", "Top", AlignStartHorizontal],
    ["center", "Centre", AlignCenterVertical],
    ["middle", "Middle", AlignCenterHorizontal],
    ["right", "Right", AlignEndVertical],
    ["bottom", "Bottom", AlignEndHorizontal],
  ];
  const item = "flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[var(--st-hover)] disabled:opacity-35 disabled:hover:bg-transparent";
  return (
    <Popover title="Align elements" width={260} trigger={<><AlignCenterVertical className={icon} /> Align</>}>
      <div className={cx(panelTitle, "mb-1.5")}>Align elements</div>
      <div className="grid grid-cols-2 gap-1">
        {aligns.map(([where, label, Icon]) => (
          <button key={where} type="button" className={item} onClick={() => ed.align(ids, where)}>
            <Icon className={icon} /> {label}
          </button>
        ))}
      </div>
      <div className={cx(panelTitle, "mb-1.5 mt-3")}>Spacing</div>
      <div className="grid grid-cols-2 gap-1">
        <button type="button" className={item} disabled={ids.length < 3} onClick={() => ed.distribute(ids, "x")}>
          <Columns3 className={icon} /> Horizontally
        </button>
        <button type="button" className={item} disabled={ids.length < 3} onClick={() => ed.distribute(ids, "y")}>
          <Rows3 className={icon} /> Vertically
        </button>
      </div>
      {ids.length < 3 && <p className="mt-2 text-[11px] text-[var(--st-muted)]">Select 3 or more to space evenly.</p>}
    </Popover>
  );
}

function TextTools({ ed, l }: { ed: Editor; l: Extract<Layer, { kind: "text" }> }) {
  const bold = l.fontStyle.includes("bold");
  const italic = l.fontStyle.includes("italic");
  const style = (b: boolean, i: boolean) => (b && i ? "italic bold" : b ? "bold" : i ? "italic" : "normal");
  const size = Math.round(l.fontSize * Math.abs(l.scaleY));
  // Shown as it appears on the page, so any corner-drag scale is included.
  const setSize = (v: number) => ed.tweak(l.id, { fontSize: Math.max(6, Math.min(800, v)) / Math.abs(l.scaleY) });
  const nextAlign = { left: "center", center: "right", right: "left" } as const;
  const AlignIcon = { left: AlignLeft, center: AlignCenter, right: AlignRight }[l.align];

  return (
    <>
      <FontPicker value={l.fontFamily} onChange={(fontFamily) => ed.patch(l.id, { fontFamily })} />
      <div className="flex items-center rounded-md border border-[var(--st-line)]">
        <ToolButton title="Decrease font size" className="h-7 w-7 px-0" onClick={() => setSize(size - 1)}>
          <Minus className="h-3.5 w-3.5" />
        </ToolButton>
        <input
          aria-label="Font size"
          className="h-7 w-11 bg-transparent text-center tabular-nums outline-none"
          value={size}
          onChange={(e) => Number(e.target.value) > 0 && setSize(Number(e.target.value))}
        />
        <ToolButton title="Increase font size" className="h-7 w-7 px-0" onClick={() => setSize(size + 1)}>
          <Plus className="h-3.5 w-3.5" />
        </ToolButton>
      </div>
      <ColorButton
        letter
        title="Text colour"
        fill={l.fill}
        documentColors={ed.documentColors}
        onChange={(fill) => ed.tweak(l.id, { fill })}
      />
      <ToolButton title="Bold" active={bold} onClick={() => ed.patch(l.id, { fontStyle: style(!bold, italic) })}>
        <Bold className={icon} />
      </ToolButton>
      <ToolButton title="Italic" active={italic} onClick={() => ed.patch(l.id, { fontStyle: style(bold, !italic) })}>
        <Italic className={icon} />
      </ToolButton>
      <ToolButton
        title="Underline"
        active={l.textDecoration === "underline"}
        onClick={() => ed.patch(l.id, { textDecoration: l.textDecoration === "underline" ? "none" : "underline" })}
      >
        <Underline className={icon} />
      </ToolButton>
      <ToolButton title={`Alignment: ${l.align}`} onClick={() => ed.patch(l.id, { align: nextAlign[l.align] })}>
        <AlignIcon className={icon} />
      </ToolButton>
      <Popover title="Spacing" width={240} trigger={<span className="text-[12.5px]">Spacing</span>}>
        <div className="space-y-3">
          <Slider
            label="Letter spacing"
            value={l.letterSpacing}
            min={-10}
            max={60}
            onChange={(letterSpacing) => ed.tweak(l.id, { letterSpacing })}
          />
          <Slider
            label="Line spacing"
            value={l.lineHeight}
            min={0.5}
            max={3}
            step={0.05}
            onChange={(lineHeight) => ed.tweak(l.id, { lineHeight })}
          />
        </div>
      </Popover>
      <Divider />
    </>
  );
}

function ShapeTools({ ed, l }: { ed: Editor; l: Extract<Layer, { kind: "rect" | "ellipse" | "polygon" | "star" }> }) {
  return (
    <>
      <ColorButton title="Fill colour" fill={l.fill} documentColors={ed.documentColors} onChange={(fill) => ed.tweak(l.id, { fill })} />
      <Popover
        title="Border"
        width={250}
        trigger={
          <>
            <span
              className="h-5 w-5 rounded border-[3px]"
              style={{ borderColor: l.strokeWidth > 0 ? l.stroke : "var(--st-muted)", borderStyle: l.strokeWidth > 0 ? "solid" : "dashed" }}
            />
            <span className="text-[12.5px]">Border</span>
          </>
        }
      >
        <div className="space-y-3">
          <Slider label="Border weight" value={l.strokeWidth} min={0} max={60} onChange={(strokeWidth) => ed.tweak(l.id, { strokeWidth })} />
          <label className="flex items-center justify-between text-[12px] text-[var(--st-muted)]">
            Border colour
            <span className="relative h-7 w-10 cursor-pointer rounded-md border border-black/15" style={{ background: l.stroke }}>
              <input
                type="color"
                value={l.stroke}
                onChange={(e) => ed.tweak(l.id, { stroke: e.target.value, strokeWidth: l.strokeWidth || 4 })}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </span>
          </label>
          {l.kind === "rect" && (
            <Slider
              label="Corner rounding"
              value={l.cornerRadius}
              min={0}
              max={Math.round(Math.min(l.width, l.height) / 2)}
              onChange={(cornerRadius) => ed.tweak(l.id, { cornerRadius })}
            />
          )}
          {l.kind === "polygon" && (
            <Slider label="Sides" value={l.sides} min={3} max={12} onChange={(sides) => ed.tweak(l.id, { sides })} />
          )}
          {l.kind === "star" && (
            <>
              <Slider label="Points" value={l.numPoints} min={3} max={20} onChange={(numPoints) => ed.tweak(l.id, { numPoints })} />
              <Slider
                label="Inner radius"
                value={Math.round((l.innerRadius / l.outerRadius) * 100)}
                min={10}
                max={95}
                suffix="%"
                onChange={(v) => ed.tweak(l.id, { innerRadius: (l.outerRadius * v) / 100 })}
              />
            </>
          )}
        </div>
      </Popover>
      <Divider />
    </>
  );
}

function ImageTools({ ed, l }: { ed: Editor; l: Extract<Layer, { kind: "image" }> }) {
  const [tolerance, setTolerance] = useState(40);
  return (
    <>
      <ToolButton title="Replace with another image" active={ed.swapId === l.id} onClick={() => ed.startSwap(ed.swapId === l.id ? null : l.id)}>
        <Replace className={icon} /> Swap
      </ToolButton>
      {l.product_id && (
        <Popover title="Remove background" width={260} trigger={<><Scissors className={icon} /> BG Remover</>}>
          {(close) => (
            <div className="space-y-3">
              <Slider label="Tolerance" value={tolerance} min={5} max={120} onChange={setTolerance} />
              <p className="text-[11.5px] leading-snug text-[var(--st-muted)]">
                Works on plain backdrops. Raise it if some backdrop is left; lower it if the product gets cut. Undo brings the original back.
              </p>
              <button
                type="button"
                className={cx(accentBtn, "w-full")}
                disabled={ed.removing}
                onClick={() => {
                  ed.cutOut(l.id, tolerance);
                  close();
                }}
              >
                <Scissors className={icon} />
                {ed.removing ? "Removing…" : "Remove background"}
              </button>
            </div>
          )}
        </Popover>
      )}
      <Popover title="Flip" width={170} trigger={<><FlipHorizontal2 className={icon} /> Flip</>}>
        {(close) => (
          <div className="space-y-1">
            {(
              [
                ["x", "Flip horizontal", FlipHorizontal2],
                ["y", "Flip vertical", FlipVertical2],
              ] as const
            ).map(([axis, label, Icon]) => (
              <button
                key={axis}
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--st-hover)]"
                onClick={() => {
                  ed.flip(l.id, axis);
                  close();
                }}
              >
                <Icon className={icon} /> {label}
              </button>
            ))}
          </div>
        )}
      </Popover>
      <ToolButton title="Shrink to fit inside the page and centre it" onClick={() => ed.fitToPage(l.id)}>
        <Maximize2 className={icon} /> Fit to page
      </ToolButton>
      <Divider />
    </>
  );
}

function PositionMenu({ ed, ids }: { ed: Editor; ids: string[] }) {
  const arrange: [LayerMove, string, typeof ArrowUp, string][] = [
    ["forward", "Forward", ArrowUp, "Ctrl+]"],
    ["backward", "Backward", ArrowDown, "Ctrl+["],
    ["front", "To front", BringToFront, "Ctrl+Shift+]"],
    ["back", "To back", SendToBack, "Ctrl+Shift+["],
  ];
  const aligns: [PageAlign, string, typeof ArrowUp][] = [
    ["top", "Top", AlignStartHorizontal],
    ["left", "Left", AlignStartVertical],
    ["middle", "Middle", AlignCenterHorizontal],
    ["center", "Centre", AlignCenterVertical],
    ["bottom", "Bottom", AlignEndHorizontal],
    ["right", "Right", AlignEndVertical],
  ];
  const item = "flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[var(--st-hover)]";

  return (
    <Popover title="Position" align="right" width={290} trigger={<span className="text-[12.5px]">Position</span>}>
      <div className={cx(panelTitle, "mb-1.5")}>Arrange</div>
      <div className="grid grid-cols-2 gap-1">
        {arrange.map(([m, label, Icon, key]) => (
          <button key={m} type="button" className={item} onClick={() => ed.move(ids, m)} title={key}>
            <Icon className={icon} /> {label}
          </button>
        ))}
      </div>
      {ids.length === 1 && (
        <>
          <div className={cx(panelTitle, "mb-1.5 mt-3")}>Align to page</div>
          <div className="grid grid-cols-2 gap-1">
            {aligns.map(([where, label, Icon]) => (
              <button key={where} type="button" className={item} onClick={() => ed.align(ids, where)}>
                <Icon className={icon} /> {label}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="mt-3 text-[11px] text-[var(--st-muted)]">
        Tip: drag layers in the Layers panel to reorder.
      </p>
    </Popover>
  );
}
