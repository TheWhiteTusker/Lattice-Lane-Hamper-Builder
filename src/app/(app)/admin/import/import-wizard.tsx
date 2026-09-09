"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { runImport, type ImportReport } from "./actions";
import type { Grid, ImportInput } from "@/lib/import";

/** The six tabs, in the order they should be loaded. `label` is also the tab
 *  name inside the workbook, which is how a whole .xlsx is split up below. */
const SHEETS = [
  { key: "settings", label: "Settings", hint: "Categories and the counts-as-item flag" },
  { key: "products", label: "Product Master", hint: "Codes, costs, margins, selling prices" },
  { key: "hamperSummary", label: "Hamper Summary", hint: "One row per saved hamper" },
  { key: "hamperDetails", label: "Hamper Details", hint: "The products inside each hamper" },
  { key: "quotationRegister", label: "Quotation Register", hint: "One row per quotation or PI" },
  { key: "quoteDetails", label: "Quote Details", hint: "The hampers on each quotation" },
] as const;

type SheetKey = (typeof SHEETS)[number]["key"];

const parseCsv = (file: File): Promise<Grid> =>
  new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: "greedy",
      complete: (out) => resolve(out.data),
      error: reject,
    });
  });

export function ImportWizard() {
  const [grids, setGrids] = useState<Partial<Record<SheetKey, Grid>>>({});
  const [fileNames, setFileNames] = useState<Partial<Record<SheetKey, string>>>({});
  const [report, setReport] = useState<ImportReport | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [parseError, setParseError] = useState<string | null>(null);

  /**
   * One .xlsx holding all six tabs. SheetJS is imported on demand so its
   * ~1MB does not sit in the page bundle for people using CSVs.
   */
  async function pickWorkbook(file: File | null) {
    setReport(null);
    setConfirmed(false);
    if (!file) return;

    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());

      const nextGrids: Partial<Record<SheetKey, Grid>> = {};
      const nextNames: Partial<Record<SheetKey, string>> = {};
      const missing: string[] = [];

      for (const sheet of SHEETS) {
        const ws = wb.Sheets[sheet.label];
        if (!ws) {
          missing.push(sheet.label);
          continue;
        }
        // raw: false so dates and percentages arrive as the text the sheet
        // shows, which is what the CSV path gives the mapper too.
        const grid = XLSX.utils.sheet_to_json<string[]>(ws, {
          header: 1,
          raw: false,
          defval: "",
          blankrows: false,
        });
        nextGrids[sheet.key] = grid;
        nextNames[sheet.key] = `${sheet.label} · ${Math.max(grid.length - 1, 0)} rows`;
      }

      setGrids(nextGrids);
      setFileNames(nextNames);
      setParseError(
        missing.length ? `${file.name} has no tab named: ${missing.join(", ")}` : null,
      );
    } catch {
      setParseError(`Could not read ${file.name}. Check it is a .xlsx workbook.`);
    }
  }

  async function pick(key: SheetKey, file: File | null) {
    setReport(null);
    setConfirmed(false);

    if (!file) {
      setGrids((g) => ({ ...g, [key]: undefined }));
      setFileNames((n) => ({ ...n, [key]: undefined }));
      return;
    }

    try {
      const grid = await parseCsv(file);
      setGrids((g) => ({ ...g, [key]: grid }));
      setFileNames((n) => ({ ...n, [key]: `${file.name} · ${Math.max(grid.length - 1, 0)} rows` }));
      setParseError(null);
    } catch {
      setParseError(`Could not read ${file.name}. Export it again as CSV.`);
    }
  }

  function run(apply: boolean) {
    startTransition(async () => {
      const result = await runImport(grids as ImportInput, apply);
      setReport(result);
      if (apply) setConfirmed(false);
    });
  }

  const anyLoaded = Object.values(grids).some(Boolean);

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="text-sm font-semibold">1. Load the spreadsheet</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Easiest: File → Download → Microsoft Excel (.xlsx) once, and drop the whole
          workbook here. Columns are read by position, so leave the layout exactly as it is —
          renamed headers are fine, reordered columns are not.
        </p>

        <div className="mt-3 rounded-md border border-[var(--color-line)] p-3">
          <label className="label" htmlFor="workbook">
            Whole workbook (.xlsx)
          </label>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Splits into the six tabs below by name
          </p>
          <input
            id="workbook"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="mt-2 w-full text-sm"
            onChange={(e) => pickWorkbook(e.target.files?.[0] ?? null)}
          />
        </div>

        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Or load tabs one at a time, as CSV. These override anything the workbook filled in.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {SHEETS.map((sheet) => (
            <div key={sheet.key} className="rounded-md border border-[var(--color-line)] p-3">
              <label className="label" htmlFor={sheet.key}>
                {sheet.label}
              </label>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">{sheet.hint}</p>
              <input
                id={sheet.key}
                type="file"
                accept=".csv,text/csv"
                className="mt-2 w-full text-sm"
                onChange={(e) => pick(sheet.key, e.target.files?.[0] ?? null)}
              />
              {fileNames[sheet.key] && (
                <p className="mt-1 text-xs text-green-800">{fileNames[sheet.key]}</p>
              )}
            </div>
          ))}
        </div>

        {parseError && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {parseError}
          </p>
        )}
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-semibold">2. Check what will be imported</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          A dry run reads the files and reports what it found. Nothing is written yet.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => run(false)}
            disabled={!anyLoaded || pending}
          >
            {pending ? "Checking…" : "Dry run"}
          </button>
        </div>

        {report && (
          <div className="mt-4">
            {report.error ? (
              <p role="alert" className="text-sm text-red-700">
                {report.error}
              </p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  {Object.entries(report.counts ?? {}).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-md border border-[var(--color-line)] px-3 py-2"
                    >
                      <div className="label">{labelFor(key)}</div>
                      <div className="text-lg font-semibold tabular-nums">{value}</div>
                    </div>
                  ))}
                </div>

                {!!report.warnings?.length && (
                  <ul className="mt-3 space-y-1.5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {report.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}

                {report.applied && (
                  <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
                    Import complete. Document numbering now continues from the highest
                    imported code.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-semibold">3. Import</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Records are matched on product code, hamper code and document number, so running
          this twice updates rather than duplicates. Existing hamper and quotation lines are
          replaced by what is in the files.
        </p>

        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          I have run the dry run above and the numbers look right.
        </label>

        <button
          type="button"
          className="btn-primary mt-3"
          onClick={() => run(true)}
          disabled={!anyLoaded || !confirmed || pending}
        >
          {pending ? "Importing…" : "Import into the database"}
        </button>
      </section>
    </div>
  );
}

function labelFor(key: string) {
  const labels: Record<string, string> = {
    categories: "Categories",
    products: "Products",
    hampers: "Hampers",
    hamperItems: "Hamper lines",
    quotes: "Quotations",
    quoteItems: "Quotation lines",
  };
  return labels[key] ?? key;
}
