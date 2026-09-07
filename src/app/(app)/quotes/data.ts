import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSettings } from "@/lib/settings";
import type { HamperOption } from "./quote-builder";

/** Hampers offered by the quote builder's picker, plus the pick-lists. */
export async function loadQuoteOptions(supabase: SupabaseClient) {
  const [{ data: hampers }, settings] = await Promise.all([
    supabase
      .from("hamper_summary")
      .select("id, code, name, final_catalogue_sp")
      .order("code")
      .returns<HamperOption[]>(),
    loadSettings(supabase),
  ]);

  return { hampers: hampers ?? [], settings };
}
