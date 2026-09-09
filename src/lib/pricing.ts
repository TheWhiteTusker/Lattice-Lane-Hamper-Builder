/**
 * Every number in the app comes from here.
 *
 * These functions are the client-side mirror of the `hamper_summary` and
 * `quote_summary` SQL views, used to show live totals while someone is typing.
 * The database is still the authority once a record is saved - if the two ever
 * disagree, the view is right and this file is the bug.
 *
 * The formulas are lifted from the Apps Script, chiefly refreshHamperPrices()
 * which is the only place the spreadsheet spelled them out in code rather than
 * hiding them in cell formulas.
 */

/** Money, rounded for display. Postgres numeric is exact; JS doubles are not. */
export const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Treat blank / null / non-numeric as 0, the way the sheet's Number(x)||0 did.
 * A trailing % is dropped rather than rejected: exports of a percent-formatted
 * cell carry it through as "80.00%", and normalizePct() scales it after.
 */
export const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[,\s₹%]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Percentages are stored as fractions (0.35 = 35%), which is how Google Sheets
 * stores a percent-formatted cell. Spreadsheet exports sometimes come through
 * as 35 instead, so anything above 1 is assumed to be a whole percent.
 */
export const normalizePct = (v: unknown): number => {
  const n = num(v);
  return n > 1 ? n / 100 : n;
};

// ---------------------------------------------------------------
// HAMPERS
// ---------------------------------------------------------------

export type HamperLineInput = {
  qty: number;
  unitCp: number;
  unitSp: number;
  /** categoryCountsAsItem(): unknown categories count, so this defaults true. */
  countsAsItem?: boolean;
};

export type HamperPricing = {
  totalCp: number;
  baseSp: number;
  numberOfItems: number;
  spAfterDiscount: number;
  /** null until a Target SP is set. */
  variance: number | null;
  /** null until a Final Catalogue SP is approved. */
  grossProfit: number | null;
  finalMargin: number | null;
};

export function priceHamper(
  lines: HamperLineInput[],
  opts: {
    discountPct?: number;
    targetSp?: number | null;
    finalCatalogueSp?: number | null;
  } = {},
): HamperPricing {
  const discountPct = num(opts.discountPct);

  let totalCp = 0;
  let baseSp = 0;
  let numberOfItems = 0;

  for (const line of lines) {
    const qty = num(line.qty);
    totalCp += qty * num(line.unitCp);
    baseSp += qty * num(line.unitSp);
    // Inside packaging adds cost but is not one of the "items" advertised.
    if (line.countsAsItem !== false) numberOfItems += qty;
  }

  const spAfterDiscount = baseSp * (1 - discountPct);

  const targetSp = opts.targetSp ?? null;
  const finalSp = opts.finalCatalogueSp ?? null;

  // Gross profit is measured against the *approved* catalogue price, never the
  // computed one. refreshHamperPrices() preserves that override on purpose.
  const grossProfit = finalSp === null ? null : finalSp - totalCp;

  return {
    totalCp,
    baseSp,
    numberOfItems,
    spAfterDiscount,
    variance: targetSp === null ? null : spAfterDiscount - targetSp,
    grossProfit,
    finalMargin:
      finalSp === null || finalSp === 0 || grossProfit === null
        ? null
        : grossProfit / finalSp,
  };
}

// ---------------------------------------------------------------
// QUOTES
// ---------------------------------------------------------------

export type QuoteLineInput = {
  qty: number;
  cataloguePrice: number;
  discountPct?: number;
};

/** Sheet columns G and H, now generated columns on quote_items. */
export function priceQuoteLine(line: QuoteLineInput) {
  const finalRate = num(line.cataloguePrice) * (1 - num(line.discountPct));
  return { finalRate, amount: num(line.qty) * finalRate };
}

export const COMBINED_ORDER = "Combined Order";

export type QuotePricing = {
  subtotal: number;
  totalQty: number;
  /** null for option-style quotes: the client picks one, so there is no total. */
  taxableValue: number | null;
  gstAmount: number | null;
  grandTotal: number | null;
};

export function priceQuote(
  lines: QuoteLineInput[],
  opts: {
    quoteStructure?: string;
    orderDiscount?: number;
    adj1?: number;
    adj2?: number;
    gstRate?: number;
  } = {},
): QuotePricing {
  let subtotal = 0;
  let totalQty = 0;

  for (const line of lines) {
    subtotal += priceQuoteLine(line).amount;
    totalQty += num(line.qty);
  }

  // Mirrors =IF(B7="Combined Order", ...) on H22/H26/H28/H29.
  if (opts.quoteStructure !== COMBINED_ORDER) {
    return { subtotal, totalQty, taxableValue: null, gstAmount: null, grandTotal: null };
  }

  const taxableValue =
    subtotal - num(opts.orderDiscount) + num(opts.adj1) + num(opts.adj2);
  const gstAmount = taxableValue * num(opts.gstRate);

  return {
    subtotal,
    totalQty,
    taxableValue,
    gstAmount,
    grandTotal: taxableValue + gstAmount,
  };
}

// ---------------------------------------------------------------
// DISPLAY
// ---------------------------------------------------------------

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatMoney = (v: number | null | undefined): string =>
  v === null || v === undefined ? "" : inr.format(round2(num(v)));

export const formatPct = (v: number | null | undefined, digits = 1): string =>
  v === null || v === undefined ? "" : `${(num(v) * 100).toFixed(digits)}%`;
