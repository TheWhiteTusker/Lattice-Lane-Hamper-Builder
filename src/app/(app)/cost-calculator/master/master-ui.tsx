"use client";

import { useState } from "react";
import type { CostVariety } from "@/lib/types";

/** What every level of the hierarchy needs from the master view. */
export type MasterCtx = {
  isPending: boolean;
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  expand: (id: string) => void;
  /** Runs a server action, showing its error or `success` in the banner. */
  run: (action: () => Promise<{ error?: string }>, success: string, after?: () => void) => void;
  editVariety: (subcategoryId: string, variety: Partial<CostVariety>) => void;
};

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform duration-150 ${open ? "rotate-90" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Inline name box for adding a category or subcategory. */
export function InlineAdd({
  placeholder,
  saveLabel,
  busy,
  className,
  onSave,
  onCancel,
}: {
  placeholder: string;
  saveLabel: string;
  busy: boolean;
  className: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div
      className={`rounded-lg border border-[var(--color-brand)] p-3 flex flex-wrap items-center gap-3 ${className}`}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="input text-xs py-1.5 max-w-xs"
        autoFocus
      />
      <button
        type="button"
        onClick={() => onSave(value.trim())}
        disabled={busy || !value.trim()}
        className="btn-primary text-xs py-1.5"
      >
        {saveLabel}
      </button>
      <button type="button" onClick={onCancel} className="btn-secondary text-xs py-1.5">
        Cancel
      </button>
    </div>
  );
}
