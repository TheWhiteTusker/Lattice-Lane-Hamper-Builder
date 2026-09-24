"use client";

import { useState, useTransition } from "react";
import { syncAllRates } from "./sync-actions";

/** One click to bring every saved product costing up to the master's current rates. */
export function SyncRatesButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(null);

  function sync() {
    if (
      !confirm(
        "Update every product whose costing uses an out-of-date rate, unit or name from this master? Their costs and selling prices are recalculated (each keeps its margin). Quotations and invoices don't change.",
      )
    )
      return;
    setResult(null);
    startTransition(async () => setResult(await syncAllRates()));
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <h3 className="text-sm font-bold text-[var(--color-ink)]">Products using older rates</h3>
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">
          Editing a rate updates products automatically. Products costed before a change can be brought up to date here.
        </p>
        {result?.message && <p className="mt-1.5 text-xs font-medium text-emerald-700">{result.message}</p>}
        {result?.error && <p className="mt-1.5 text-xs font-medium text-red-700">{result.error}</p>}
      </div>
      <button type="button" onClick={sync} disabled={pending} className="btn-secondary text-xs">
        {pending ? "Syncing…" : "Sync products with current rates"}
      </button>
    </div>
  );
}
