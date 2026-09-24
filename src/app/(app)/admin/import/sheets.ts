import Papa from "papaparse";
import type { Grid } from "@/lib/import";

/** The six tabs, in the order they should be loaded. `label` is also the tab
 *  name inside the workbook, which is how a whole .xlsx is split up below. */
export const SHEETS = [
  { key: "settings", label: "Settings", hint: "Categories and the counts-as-item flag" },
  { key: "products", label: "Product Master", hint: "Codes, costs, margins, selling prices" },
  { key: "hamperSummary", label: "Hamper Summary", hint: "One row per saved hamper" },
  { key: "hamperDetails", label: "Hamper Details", hint: "The products inside each hamper" },
  { key: "quotationRegister", label: "Quotation Register", hint: "One row per quotation or PI" },
  { key: "quoteDetails", label: "Quote Details", hint: "The hampers on each quotation" },
] as const;

export type SheetKey = (typeof SHEETS)[number]["key"];

export const parseCsv = (file: File): Promise<Grid> =>
  new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: "greedy",
      complete: (out) => resolve(out.data),
      error: reject,
    });
  });
