"use client";

import { useId, useState } from "react";

/** A labelled read-only figure in the pricing strip. */
export function Cell({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  strong?: boolean;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div
        className={[
          "mt-1 tabular-nums",
          strong ? "text-base font-semibold" : "text-sm font-medium",
          tone === "bad" ? "text-red-700" : tone === "good" ? "text-green-800" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

export function NumField({
  id,
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="w-[120px]">
      <label className="label" htmlFor={id} title={hint}>
        {label}
      </label>
      <input
        id={id}
        inputMode="decimal"
        className="input input-num mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

/**
 * Type-to-filter picker. A native <datalist> does the searching, which is why
 * there is no dropdown library here: the browser already ships one that works
 * with the keyboard, on mobile, and without JavaScript state to keep in sync.
 *
 * `draft` holds what is being typed until it matches something; on blur the
 * field snaps back to the saved value.
 */
export function Combo({
  label,
  value,
  options,
  placeholder,
  disabled,
  onPick,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  onPick: (text: string) => void;
}) {
  const listId = useId();
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <>
      <input
        aria-label={label}
        className="input"
        list={listId}
        placeholder={placeholder}
        value={draft ?? value}
        disabled={disabled}
        onChange={(e) => {
          setDraft(e.target.value);
          onPick(e.target.value);
        }}
        onBlur={() => setDraft(null)}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

export function RowButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-1.5 py-0.5 text-[var(--color-muted)] disabled:opacity-30 ${
        danger ? "hover:bg-red-50 hover:text-red-700" : "hover:bg-[var(--color-paper)]"
      }`}
    >
      {children}
    </button>
  );
}
