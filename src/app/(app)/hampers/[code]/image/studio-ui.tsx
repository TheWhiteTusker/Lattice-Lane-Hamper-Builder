"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { fillCss, type Fill } from "@/lib/hamper-canvas";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const toolBtn =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-[13px] text-[var(--st-text)] " +
  "transition-colors hover:bg-[var(--st-hover)] disabled:pointer-events-none disabled:opacity-35";
export const toolBtnActive = "bg-[var(--st-accent-soft)] text-white hover:bg-[var(--st-accent-soft)]";
export const fieldCls =
  "h-8 rounded-md border border-[var(--st-line)] bg-[var(--st-panel-2)] px-2 text-[13px] text-[var(--st-text)] " +
  "outline-none focus:border-[var(--st-accent)]";
export const accentBtn =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-[var(--st-accent)] px-3 text-[13px] font-medium " +
  "text-white hover:brightness-110 disabled:opacity-50";
export const panelTitle = "text-[11px] font-semibold uppercase tracking-wider text-[var(--st-muted)]";

export function ToolButton({
  title,
  active,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} className={cx(toolBtn, active && toolBtnActive, className)} {...rest}>
      {children}
    </button>
  );
}

export const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-[var(--st-line)]" />;

/** A toolbar button that opens a panel beneath it; closes on outside click or Escape. */
export function Popover({
  trigger,
  title,
  active,
  align = "left",
  width = 260,
  className,
  children,
}: {
  trigger: ReactNode;
  title: string;
  active?: boolean;
  align?: "left" | "right";
  width?: number;
  className?: string;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <ToolButton title={title} active={open || active} className={className} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </ToolButton>
      {open && (
        <div
          className={cx(
            "absolute top-full z-50 mt-1.5 rounded-lg border border-[var(--st-line)] bg-[var(--st-panel)] p-3 shadow-2xl shadow-black/60",
            align === "right" ? "right-0" : "left-0",
          )}
          style={{ width }}
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

/** A labelled range slider with its value shown alongside. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-[12px] text-[var(--st-muted)]">
        {label}
        <span className="tabular-nums text-[var(--st-text)]">
          {Number(value.toFixed(2))}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
      />
    </label>
  );
}

/**
 * After Effects-style number: drag the label left/right to scrub the value
 * (Shift = ×10), or click the field and type.
 */
export function ScrubNumber({
  label,
  value,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
  precision = 0,
  suffix,
  disabled,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  precision?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const tidy = (v: number) => Number(Math.min(max, Math.max(min, v)).toFixed(precision));

  const commit = () => {
    if (draft !== null && draft.trim() !== "" && Number.isFinite(Number(draft))) onChange(tidy(Number(draft)));
    setDraft(null);
  };

  return (
    <div className={cx("flex min-w-0 items-center gap-1.5", disabled && "opacity-40")}>
      <span
        className="shrink-0 cursor-ew-resize select-none text-[12px] text-[var(--st-muted)] hover:text-[var(--st-accent)]"
        onPointerDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          const el = e.currentTarget;
          el.setPointerCapture(e.pointerId);
          const startX = e.clientX;
          const start = value;
          const move = (ev: PointerEvent) =>
            onChange(tidy(start + (ev.clientX - startX) * step * (ev.shiftKey ? 10 : 1)));
          const up = () => {
            el.removeEventListener("pointermove", move);
            el.removeEventListener("pointerup", up);
          };
          el.addEventListener("pointermove", move);
          el.addEventListener("pointerup", up);
        }}
      >
        {label}
      </span>
      <input
        disabled={disabled}
        inputMode="decimal"
        aria-label={typeof label === "string" ? label : undefined}
        className="h-7 w-full min-w-0 rounded border border-transparent bg-transparent px-1 text-[12px] tabular-nums text-[#7cc4ff] outline-none hover:border-[var(--st-line)] focus:border-[var(--st-accent)] focus:bg-[var(--st-panel-2)] focus:text-[var(--st-text)]"
        value={draft ?? String(tidy(value))}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            setDraft(null);
            onChange(tidy(value + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1)));
          }
        }}
      />
      {suffix && <span className="shrink-0 text-[11px] text-[var(--st-muted)]">{suffix}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ colour */

const DEFAULT_COLORS = [
  "#000000", "#545454", "#737373", "#a6a6a6", "#d9d9d9", "#ffffff",
  "#ff3131", "#ff5757", "#ff66c4", "#cb6ce6", "#8c52ff", "#5e17eb",
  "#0097b2", "#0cc0df", "#5ce1e6", "#38b6ff", "#5271ff", "#004aad",
  "#00bf63", "#7ed957", "#c1ff72", "#ffde59", "#ffbd59", "#ff914d",
  "#2c332f", "#54655b", "#ddcf8b", "#faf8ee", "#f1ebe0", "#b08d57",
];

const GRADIENT_PRESETS: Fill[] = [
  { type: "linear", from: "#faf8ee", to: "#ddcf8b", angle: 90 },
  { type: "linear", from: "#54655b", to: "#2c332f", angle: 90 },
  { type: "linear", from: "#ffde59", to: "#ff914d", angle: 45 },
  { type: "linear", from: "#ff66c4", to: "#ffde59", angle: 45 },
  { type: "linear", from: "#5de0e6", to: "#004aad", angle: 45 },
  { type: "linear", from: "#8c52ff", to: "#ff914d", angle: 0 },
  { type: "linear", from: "#ffffff", to: "#d9d9d9", angle: 90 },
  { type: "linear", from: "#000000", to: "#737373", angle: 90 },
  { type: "linear", from: "#b08d57", to: "#f1ebe0", angle: 135 },
  { type: "linear", from: "#0cc0df", to: "#ffde59", angle: 90 },
];

function Swatch({ fill, selected, onClick, title }: { fill: Fill; selected?: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cx(
        "relative aspect-square w-full rounded-md border border-white/15 transition-transform hover:scale-110",
        selected && "ring-2 ring-[var(--st-accent)] ring-offset-2 ring-offset-[var(--st-panel)]",
      )}
      style={{ background: fillCss(fill) }}
    >
      {selected && <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white mix-blend-difference" />}
    </button>
  );
}

/** Rainbow "+" swatch that opens the system colour picker. */
function CustomColor({ value, onChange, title }: { value: string; onChange: (c: string) => void; title: string }) {
  return (
    <label
      title={title}
      className="relative flex aspect-square w-full cursor-pointer items-center justify-center rounded-md border border-white/15 hover:scale-110"
      style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
    >
      <Plus className="h-4 w-4 text-white drop-shadow" />
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
    </label>
  );
}

export function ColorPanel({
  fill,
  onChange,
  documentColors,
  allowGradient = true,
}: {
  fill: Fill;
  onChange: (fill: Fill) => void;
  documentColors: string[];
  allowGradient?: boolean;
}) {
  const [tab, setTab] = useState<"solid" | "linear">(fill.type);
  const first = fill.type === "solid" ? fill.color : fill.from;

  return (
    <div className="space-y-3">
      {allowGradient && (
        <div className="grid grid-cols-2 gap-1 rounded-md bg-[var(--st-panel-2)] p-1">
          {(["solid", "linear"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cx("h-7 rounded text-[12px]", tab === t ? "bg-[var(--st-hover)] text-white" : "text-[var(--st-muted)]")}
            >
              {t === "solid" ? "Solid colour" : "Gradient"}
            </button>
          ))}
        </div>
      )}

      {tab === "solid" ? (
        <>
          {documentColors.length > 0 && (
            <div>
              <div className={cx(panelTitle, "mb-1.5")}>Document colours</div>
              <div className="grid grid-cols-6 gap-1.5">
                <CustomColor value={first} title="Custom colour" onChange={(color) => onChange({ type: "solid", color })} />
                {documentColors.slice(0, 11).map((c) => (
                  <Swatch
                    key={c}
                    title={c}
                    fill={{ type: "solid", color: c }}
                    selected={fill.type === "solid" && fill.color === c}
                    onClick={() => onChange({ type: "solid", color: c })}
                  />
                ))}
              </div>
            </div>
          )}
          <div>
            <div className={cx(panelTitle, "mb-1.5")}>Default colours</div>
            <div className="grid grid-cols-6 gap-1.5">
              {documentColors.length === 0 && (
                <CustomColor value={first} title="Custom colour" onChange={(color) => onChange({ type: "solid", color })} />
              )}
              {DEFAULT_COLORS.map((c) => (
                <Swatch
                  key={c}
                  title={c}
                  fill={{ type: "solid", color: c }}
                  selected={fill.type === "solid" && fill.color === c}
                  onClick={() => onChange({ type: "solid", color: c })}
                />
              ))}
            </div>
          </div>
          <input
            className={cx(fieldCls, "w-full font-mono uppercase")}
            value={first}
            aria-label="Hex colour"
            onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && onChange({ type: "solid", color: e.target.value.toLowerCase() })}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-1.5">
            {GRADIENT_PRESETS.map((g, i) => (
              <Swatch key={i} title="Gradient preset" fill={g} onClick={() => onChange(g)} />
            ))}
          </div>
          {(() => {
            const g: Extract<Fill, { type: "linear" }> =
              fill.type === "linear" ? fill : { type: "linear", from: first, to: "#ffffff", angle: 90 };
            return (
              <>
                <div className="h-8 rounded-md border border-white/15" style={{ background: fillCss(g) }} />
                <div className="flex items-center gap-2">
                  {(["from", "to"] as const).map((k) => (
                    <label key={k} className="flex flex-1 items-center gap-2 text-[12px] text-[var(--st-muted)]">
                      <span
                        className="relative h-7 w-7 shrink-0 cursor-pointer rounded-md border border-white/15"
                        style={{ background: g[k] }}
                      >
                        <input
                          type="color"
                          value={g[k]}
                          onChange={(e) => onChange({ ...g, [k]: e.target.value })}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                      </span>
                      {k === "from" ? "Start" : "End"}
                    </label>
                  ))}
                </div>
                <Slider label="Angle" value={g.angle} min={0} max={359} suffix="°" onChange={(angle) => onChange({ ...g, angle })} />
                <div className="flex gap-1">
                  {[0, 45, 90, 135, 180, 270].map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => onChange({ ...g, angle: a })}
                      className={cx(toolBtn, "h-7 flex-1 px-0 text-[11px]", g.angle === a && toolBtnActive)}
                    >
                      {a}°
                    </button>
                  ))}
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

/** Canva-style colour swatch button in the toolbar. */
export function ColorButton({
  fill,
  onChange,
  documentColors,
  title,
  allowGradient,
  letter,
}: {
  fill: Fill;
  onChange: (fill: Fill) => void;
  documentColors: string[];
  title: string;
  allowGradient?: boolean;
  /** Show as an "A" underlined with the colour, like Canva's text colour. */
  letter?: boolean;
}) {
  return (
    <Popover
      title={title}
      width={264}
      trigger={
        letter ? (
          <span className="flex flex-col items-center leading-none">
            <span className="text-[15px] font-semibold">A</span>
            <span className="mt-0.5 h-1 w-5 rounded-full" style={{ background: fillCss(fill) }} />
          </span>
        ) : (
          <span className="h-6 w-6 rounded-md border border-white/25" style={{ background: fillCss(fill) }} />
        )
      }
    >
      <ColorPanel fill={fill} onChange={onChange} documentColors={documentColors} allowGradient={allowGradient} />
    </Popover>
  );
}

/* ------------------------------------------------------------------- fonts */

export const FONTS: { family: string; google?: string }[] = [
  { family: "Playfair Display", google: "Playfair+Display:ital,wght@0,400;0,700;1,400;1,700" },
  { family: "Cormorant Garamond", google: "Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700" },
  { family: "Lora", google: "Lora:ital,wght@0,400;0,700;1,400;1,700" },
  { family: "Cinzel", google: "Cinzel:wght@400;700" },
  { family: "Montserrat", google: "Montserrat:ital,wght@0,400;0,700;1,400;1,700" },
  { family: "Poppins", google: "Poppins:ital,wght@0,400;0,700;1,400;1,700" },
  { family: "Inter", google: "Inter:ital,wght@0,400;0,700;1,400;1,700" },
  { family: "Cabin", google: "Cabin:ital,wght@0,400;0,700;1,400;1,700" },
  { family: "Oswald", google: "Oswald:wght@400;700" },
  { family: "Bebas Neue", google: "Bebas+Neue" },
  { family: "Great Vibes", google: "Great+Vibes" },
  { family: "Dancing Script", google: "Dancing+Script:wght@400;700" },
  { family: "Pacifico", google: "Pacifico" },
  { family: "Arial" },
  { family: "Georgia" },
  { family: "Times New Roman" },
  { family: "Courier New" },
];

export const FONTS_HREF = `https://fonts.googleapis.com/css2?${FONTS.filter((f) => f.google)
  .map((f) => `family=${f.google}`)
  .join("&")}&display=swap`;

export function FontPicker({ value, onChange }: { value: string; onChange: (family: string) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(
    () => FONTS.filter((f) => f.family.toLowerCase().includes(q.trim().toLowerCase())),
    [q],
  );
  return (
    <Popover
      title="Font"
      width={240}
      className="w-44 justify-between border border-[var(--st-line)] bg-[var(--st-panel-2)]"
      trigger={
        <>
          <span className="truncate" style={{ fontFamily: value }}>
            {value}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--st-muted)]" />
        </>
      }
    >
      {(close) => (
        <>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-[var(--st-muted)]" />
            <input
              autoFocus
              className={cx(fieldCls, "w-full pl-8")}
              placeholder="Search fonts"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {list.map((f) => (
              <button
                key={f.family}
                type="button"
                onClick={() => {
                  onChange(f.family);
                  close();
                }}
                className={cx(
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[15px] hover:bg-[var(--st-hover)]",
                  f.family === value && "text-[var(--st-accent)]",
                )}
                style={{ fontFamily: f.family }}
              >
                {f.family}
                {f.family === value && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </>
      )}
    </Popover>
  );
}
