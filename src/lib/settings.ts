import type { SupabaseClient } from "@supabase/supabase-js";
import type { Settings } from "@/lib/types";

/** Used when a key is missing from app_settings - matches 0003_seed.sql. */
export const SETTINGS_DEFAULTS: Settings = {
  company: { name: "Lattice Lane", address: "", gstin: "", phone: "", email: "", website: "" },
  gst_rate: 0.18,
  doc_prefixes: { hamper: "H", quotation: "LLQT-", proforma_invoice: "LLPI-" },
  hamper_statuses: ["Draft", "Approved", "Active", "Discontinued"],
  quote_statuses: ["Draft", "Sent", "Negotiation", "Won", "Lost", "Expired"],
  quote_structures: ["Combined Order", "Option Based"],
  validity_options: ["7 Days", "15 Days", "30 Days"],
  collections: [],
  sources: [],
  detail_modes: ["Show Contents", "Summary Only", "Hide Contents"],
  default_detail_mode: "Show Contents",
  packaging_treatments: [
    "Absorb into Box & Packaging",
    "Charge Separately",
    "Show as Line Item",
  ],
  default_packaging_treatment: "Absorb into Box & Packaging",
  default_validity: "15 Days",
  quote_terms: "",
  product_colors: ["Walnut", "Natural", "Teak", "Raw", "Dark Oak", "White", "Black"],
};

/** Flattens the app_settings key/value rows into one Settings object. */
export async function loadSettings(supabase: SupabaseClient): Promise<Settings> {
  const { data } = await supabase.from("app_settings").select("key, value");

  const stored = Object.fromEntries(
    (data ?? []).map((row: { key: string; value: unknown }) => [row.key, row.value]),
  );

  return { ...SETTINGS_DEFAULTS, ...stored } as Settings;
}

/**
 * Adds any value found in imported data to its pick-list, so the strings the
 * spreadsheet actually used survive the move instead of being replaced by our
 * guesses. Returns the merged list.
 */
export const mergeList = (existing: string[], found: (string | null | undefined)[]) => {
  const seen = new Set(existing.map((v) => v.toLowerCase()));
  const merged = [...existing];

  for (const raw of found) {
    const value = String(raw ?? "").trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    merged.push(value);
  }

  return merged;
};
