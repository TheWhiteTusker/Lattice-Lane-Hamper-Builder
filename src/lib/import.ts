/**
 * Turns the six exported sheets into rows for the database.
 *
 * Columns are read by POSITION, matching the indices the Apps Script itself
 * used, because the header text in the sheet is decorative and people rename
 * headers. Row 1 is assumed to be the header row in every sheet.
 *
 * Pure functions - no database access - so the mapping can be tested and so
 * the page can show a dry run before anything is written.
 */

import { num, normalizePct } from "./pricing.ts";

export type Grid = string[][];

export type ImportInput = {
  settings?: Grid;
  products?: Grid;
  hamperSummary?: Grid;
  hamperDetails?: Grid;
  quotationRegister?: Grid;
  quoteDetails?: Grid;
};

const cell = (row: string[] | undefined, i: number) => String(row?.[i] ?? "").trim();
const isYes = (v: string) => /^(yes|y|true|1|active)$/i.test(v.trim());
const body = (grid?: Grid) => (grid ?? []).slice(1).filter((r) => r.some((c) => String(c).trim()));

/**
 * Sheets export dates in whatever the locale was. ISO is tried first, then
 * D/M/Y, which is the Indian convention this business uses. Anything else is
 * reported rather than guessed at.
 */
export function parseDate(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export type ImportResult = {
  categories: { name: string; counts_as_item: boolean; sort_order: number }[];
  defaultDetailMode: string | null;
  products: {
    code: string;
    category_name: string | null;
    name: string;
    source: string | null;
    cost_price: number;
    target_margin: number;
    default_sp: number;
    is_active: boolean;
  }[];
  hampers: {
    code: string;
    name: string;
    collection: string | null;
    status: string;
    discount_pct: number;
    target_sp: number | null;
    final_catalogue_sp: number | null;
    notes: string | null;
  }[];
  hamperItems: {
    hamper_code: string;
    line_no: number;
    product_code: string | null;
    product_name: string;
    category_name: string | null;
    source: string | null;
    qty: number;
    unit_cp: number;
    unit_sp: number;
    target_margin: number;
  }[];
  quotes: {
    doc_no: string;
    doc_type: "quotation" | "proforma_invoice";
    doc_date: string | null;
    client_name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    occasion: string | null;
    quote_structure: string;
    status: string;
    validity: string | null;
    follow_up_date: string | null;
    notes: string | null;
    linked_doc_no: string | null;
    gst_rate: number;
    order_discount: number;
    adj1: number;
    adj2: number;
  }[];
  quoteItems: {
    doc_no: string;
    line_no: number;
    option_label: string | null;
    hamper_code: string | null;
    hamper_name: string | null;
    qty: number;
    catalogue_price: number;
    discount_pct: number;
    detail_mode: string | null;
    packaging_treatment: string | null;
  }[];
  warnings: string[];
  counts: Record<string, number>;
};

export function buildImport(input: ImportInput): ImportResult {
  const warnings: string[] = [];

  // ---- Settings: A = category, B = counts as item, H2 = default detail mode
  const categories = body(input.settings)
    .map((row, i) => ({
      name: cell(row, 0),
      counts_as_item: cell(row, 1) === "" ? true : isYes(cell(row, 1)),
      sort_order: i,
    }))
    .filter((c) => c.name);

  const defaultDetailMode = cell(input.settings?.[1], 7) || null;

  // ---- Product Master: A code, B category, C name, D source,
  //      E cost, F margin, G selling price, H active
  const products = body(input.products)
    .map((row) => ({
      code: cell(row, 0),
      category_name: cell(row, 1) || null,
      name: cell(row, 2),
      source: cell(row, 3) || null,
      cost_price: num(cell(row, 4)),
      target_margin: normalizePct(cell(row, 5)),
      default_sp: num(cell(row, 6)),
      is_active: cell(row, 7) === "" ? true : isYes(cell(row, 7)),
    }))
    .filter((p) => p.code && p.name);

  const duplicateProducts = findDuplicates(products.map((p) => p.code));
  if (duplicateProducts.length) {
    warnings.push(
      `Product Master has repeated codes, only the last of each is kept: ${duplicateProducts.join(", ")}`,
    );
  }

  // ---- Hamper Summary: only the input columns. Everything else
  //      (E, F, G, I, K, M, N) is recalculated by the hamper_summary view.
  const hampers = body(input.hamperSummary)
    .map((row) => ({
      code: cell(row, 0),
      name: cell(row, 1),
      collection: cell(row, 2) || null,
      status: cell(row, 3) || "Draft",
      discount_pct: normalizePct(cell(row, 7)),
      target_sp: cell(row, 9) === "" ? null : num(cell(row, 9)),
      final_catalogue_sp: cell(row, 11) === "" ? null : num(cell(row, 11)),
      notes: cell(row, 14) || null,
    }))
    .filter((h) => h.code && h.name);

  // ---- Hamper Details: the price snapshots, kept exactly as saved
  const lineCounter = new Map<string, number>();
  const hamperItems = body(input.hamperDetails)
    .map((row) => {
      const hamperCode = cell(row, 0);
      const lineNo = (lineCounter.get(hamperCode) ?? 0) + 1;
      lineCounter.set(hamperCode, lineNo);

      return {
        hamper_code: hamperCode,
        line_no: lineNo,
        product_code: cell(row, 4) || null,
        product_name: cell(row, 6),
        category_name: cell(row, 5) || null,
        source: cell(row, 8) || null,
        qty: num(cell(row, 7)),
        unit_cp: num(cell(row, 9)),
        target_margin: normalizePct(cell(row, 11)),
        unit_sp: num(cell(row, 12)),
      };
    })
    .filter((i) => i.hamper_code && i.product_name);

  const hamperCodes = new Set(hampers.map((h) => h.code));
  const orphanLines = [
    ...new Set(hamperItems.filter((i) => !hamperCodes.has(i.hamper_code)).map((i) => i.hamper_code)),
  ];
  if (orphanLines.length) {
    warnings.push(
      `Hamper Details refers to hampers missing from Hamper Summary, these lines are skipped: ${orphanLines.join(", ")}`,
    );
  }

  const productCodes = new Set(products.map((p) => p.code));
  const missingProducts = [
    ...new Set(
      hamperItems
        .filter((i) => i.product_code && !productCodes.has(i.product_code))
        .map((i) => i.product_code!),
    ),
  ];
  if (missingProducts.length) {
    warnings.push(
      `${missingProducts.length} product code(s) on saved hampers are not in Product Master. The saved prices are kept, but Refresh Prices will flag them: ${missingProducts.slice(0, 8).join(", ")}${missingProducts.length > 8 ? "…" : ""}`,
    );
  }

  // ---- Quote Details first, so quote totals can be reconciled below
  const quoteLineCounter = new Map<string, number>();
  const quoteItems = body(input.quoteDetails)
    .map((row) => {
      const docNo = cell(row, 0);
      const lineNo = (quoteLineCounter.get(docNo) ?? 0) + 1;
      quoteLineCounter.set(docNo, lineNo);

      return {
        doc_no: docNo,
        line_no: lineNo,
        option_label: cell(row, 1) || null,
        hamper_code: cell(row, 2) || null,
        hamper_name: cell(row, 3) || null,
        qty: num(cell(row, 4)),
        catalogue_price: num(cell(row, 5)),
        discount_pct: normalizePct(cell(row, 6)),
        detail_mode: cell(row, 9) || null,
        packaging_treatment: cell(row, 10) || null,
      };
    })
    .filter((i) => i.doc_no);

  // ---- Quotation Register
  let unparsedDates = 0;

  const quotes = body(input.quotationRegister)
    .map((row) => {
      const docNo = cell(row, 0);
      const quotedValue = num(cell(row, 11)); // L, the taxable value
      const gstAmount = num(cell(row, 12)); // M

      const docDate = parseDate(cell(row, 2));
      if (cell(row, 2) && !docDate) unparsedDates++;

      // The register stored the taxable value but never the discount or the
      // extra charges that produced it (they lived in the Builder, not a
      // saved sheet). Re-derive one adjustment so the historical total still
      // reconciles against the line items.
      const subtotal = quoteItems
        .filter((i) => i.doc_no === docNo)
        .reduce((sum, i) => sum + i.qty * i.catalogue_price * (1 - i.discount_pct), 0);

      const delta = quotedValue ? quotedValue - subtotal : 0;

      return {
        doc_no: docNo,
        doc_type: /proforma/i.test(cell(row, 1))
          ? ("proforma_invoice" as const)
          : ("quotation" as const),
        doc_date: docDate,
        client_name: cell(row, 3),
        contact_person: cell(row, 4) || null,
        phone: cell(row, 5) || null,
        email: cell(row, 6) || null,
        occasion: cell(row, 7) || null,
        quote_structure: cell(row, 8) || "Combined Order",
        status: cell(row, 14) || "Draft",
        validity: cell(row, 15) || null,
        follow_up_date: parseDate(cell(row, 16)),
        notes: cell(row, 17) || null,
        linked_doc_no: cell(row, 19) || null,
        // Recover the rate actually charged rather than assuming 18%.
        gst_rate: quotedValue > 0 && gstAmount > 0 ? round4(gstAmount / quotedValue) : 0.18,
        order_discount: delta < -0.005 ? Math.abs(delta) : 0,
        adj1: delta > 0.005 ? delta : 0,
        adj2: 0,
      };
    })
    .filter((q) => q.doc_no && q.client_name);

  if (unparsedDates) {
    warnings.push(
      `${unparsedDates} date(s) in the Quotation Register could not be read and were left blank.`,
    );
  }

  const reconciled = quotes.filter((q) => q.order_discount > 0 || q.adj1 > 0).length;
  if (reconciled) {
    warnings.push(
      `${reconciled} quotation(s) had a total that differs from the sum of their lines. The difference was recorded as an order discount or an extra charge so the original total is preserved.`,
    );
  }

  const quoteNos = new Set(quotes.map((q) => q.doc_no));
  const orphanQuoteLines = [
    ...new Set(quoteItems.filter((i) => !quoteNos.has(i.doc_no)).map((i) => i.doc_no)),
  ];
  if (orphanQuoteLines.length) {
    warnings.push(
      `Quote Details refers to documents missing from the Quotation Register, these lines are skipped: ${orphanQuoteLines.join(", ")}`,
    );
  }

  return {
    categories,
    defaultDetailMode,
    products,
    hampers,
    hamperItems: hamperItems.filter((i) => hamperCodes.has(i.hamper_code)),
    quotes,
    quoteItems: quoteItems.filter((i) => quoteNos.has(i.doc_no)),
    warnings,
    counts: {
      categories: categories.length,
      products: products.length,
      hampers: hampers.length,
      hamperItems: hamperItems.filter((i) => hamperCodes.has(i.hamper_code)).length,
      quotes: quotes.length,
      quoteItems: quoteItems.filter((i) => quoteNos.has(i.doc_no)).length,
    },
  };
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dupes.add(v);
    seen.add(v);
  }
  return [...dupes];
}
