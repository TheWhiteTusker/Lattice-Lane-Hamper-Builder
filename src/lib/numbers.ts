/** Number coercion shared by pricing, costing and import. */

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

/**
 * Rounds a selling price up to the next multiple of 10.
 * Examples: 271.50 -> 280, 270 -> 270, 270.01 -> 280, 280 -> 280.
 */
export const roundUpToNext10 = (v: unknown): number => {
  const n = num(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(n / 10) * 10;
};
