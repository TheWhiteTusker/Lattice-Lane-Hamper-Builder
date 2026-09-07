import { z } from "zod";
import { normalizePct } from "@/lib/pricing";

/** Shared result shape for every server action driving a form. */
export type ActionState = { error?: string; ok?: boolean; id?: string };

/** "" -> null, so an untouched optional input does not become an empty string. */
export const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

/** Numeric input that tolerates blanks, commas and currency symbols. */
export const money = z
  .string()
  .trim()
  .transform((v) => {
    const n = Number(v.replace(/[,\s₹]/g, ""));
    return Number.isFinite(n) ? n : 0;
  });

export const optionalMoney = z
  .string()
  .trim()
  .transform((v) => {
    if (v === "") return null;
    const n = Number(v.replace(/[,\s₹]/g, ""));
    return Number.isFinite(n) ? n : null;
  });

/** Accepts "35" or "0.35" and always stores the fraction. */
export const percent = z.string().trim().transform(normalizePct);

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.string(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

/** Turns a thrown Postgres error into something worth reading. */
export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/row-level security|permission denied/i.test(message)) {
    return "You do not have permission to do that.";
  }
  if (/duplicate key.*code/i.test(message)) {
    return "That code is already in use.";
  }
  if (/duplicate key.*doc_no/i.test(message)) {
    return "That document number is already in use.";
  }
  if (/violates foreign key/i.test(message)) {
    return "That record is still referenced elsewhere and cannot be removed.";
  }
  return message;
}
