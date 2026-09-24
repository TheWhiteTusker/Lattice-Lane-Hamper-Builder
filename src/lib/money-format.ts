/** Money, percent and amount-in-words display. */

import { num, round2 } from "./numbers.ts";

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

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const below100 = (n: number) =>
  n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim();

/** Indian grouping: crore, lakh, thousand, hundred, rest. */
function wordGroups(n: number): string[] {
  const parts: string[] = [];
  if (n >= 1e7) {
    parts.push(`${wordGroups(Math.floor(n / 1e7)).join(" ")} Crore`);
    n %= 1e7;
  }
  for (const [size, label] of [[1e5, "Lakh"], [1e3, "Thousand"], [100, "Hundred"]] as const) {
    if (n >= size) {
      parts.push(`${below100(Math.floor(n / size))} ${label}`);
      n %= size;
    }
  }
  if (n > 0) parts.push(below100(n));
  return parts;
}

const joinGroups = (parts: string[]) =>
  parts.length > 1
    ? `${parts.slice(0, -1).join(" ")} And ${parts[parts.length - 1]}`
    : (parts[0] ?? "Zero");

/** 70800 -> "Seventy Thousand And Eight Hundred Rupees Only", as printed on invoices. */
export function amountInWords(amount: number): string {
  const total = Math.round(Math.abs(num(amount)) * 100);
  const paise = total % 100;
  const rupees = joinGroups(wordGroups(Math.floor(total / 100)));
  return `${rupees} Rupees${paise ? ` And ${joinGroups(wordGroups(paise))} Paise` : ""} Only`;
}
