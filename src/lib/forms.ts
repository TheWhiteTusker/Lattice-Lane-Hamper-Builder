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

/** Turns an error (Postgres, Supabase PostgrestError, Error instance, etc.) into something worth reading. */
export function describeError(error: unknown): string {
  if (!error) return "An unexpected error occurred.";

  let message = "";
  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.message === "string" && errObj.message.trim()) {
      message = errObj.message;
    } else if (typeof errObj.error_description === "string" && errObj.error_description.trim()) {
      message = errObj.error_description;
    } else if (typeof errObj.error === "string" && errObj.error.trim()) {
      message = errObj.error;
    } else if (errObj.error && typeof errObj.error === "object") {
      const nested = errObj.error as Record<string, unknown>;
      if (typeof nested.message === "string") {
        message = nested.message;
      }
    } else if (typeof errObj.details === "string" && errObj.details.trim()) {
      message = errObj.details;
    } else {
      try {
        message = JSON.stringify(error);
      } catch {
        message = String(error);
      }
    }
  } else {
    message = String(error);
  }

  if (message === "[object Object]" || !message.trim()) {
    try {
      message = JSON.stringify(error);
    } catch {
      message = "An unexpected error occurred.";
    }
  }

  if (/row-level security|permission denied/i.test(message)) {
    return "You do not have permission to do that.";
  }
  if (/duplicate key.*gstin/i.test(message)) {
    return "A client with that GSTIN already exists.";
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
