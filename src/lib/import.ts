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

import { body, cell, isYes, type ImportInput } from "./import-cells.ts";
import type { ImportResult } from "./import-result.ts";
import { buildQuotes } from "./import-quotes.ts";

export * from "./import-cells.ts";
export type * from "./import-result.ts";

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

  const { quotes, quoteItems } = buildQuotes(input, warnings);

  return {
    categories,
    defaultDetailMode,
    products,
    hampers,
    hamperItems: hamperItems.filter((i) => hamperCodes.has(i.hamper_code)),
    quotes,
    quoteItems,
    warnings,
    counts: {
      categories: categories.length,
      products: products.length,
      hampers: hampers.length,
      hamperItems: hamperItems.filter((i) => hamperCodes.has(i.hamper_code)).length,
      quotes: quotes.length,
      quoteItems: quoteItems.length,
    },
  };
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dupes.add(v);
    seen.add(v);
  }
  return [...dupes];
}
