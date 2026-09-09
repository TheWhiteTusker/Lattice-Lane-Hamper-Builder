import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSettings } from "@/lib/settings";
import type { Category } from "@/lib/types";
import type { ContentItem } from "@/components/hamper-contents";
import type { HamperOption } from "./quote-builder";

type HamperItemRow = ContentItem & { hamper_id: string };

/**
 * Hampers offered by the quote builder's picker, plus the pick-lists and each
 * hamper's contents - the builder shows the same contents block the printed
 * document will.
 *
 * ponytail: every hamper's items in one query. Fine for a catalogue of a few
 * hundred hampers; fetch per selected hamper if it ever gets heavy.
 */
export async function loadQuoteOptions(supabase: SupabaseClient) {
  const [{ data: hampers }, { data: items }, { data: categories }, settings] = await Promise.all([
    supabase
      .from("hamper_summary")
      .select("id, code, name, final_catalogue_sp")
      .order("code")
      .returns<Omit<HamperOption, "items">[]>(),
    supabase
      .from("hamper_items")
      .select("id, hamper_id, product_name, category_name, qty")
      .order("line_no")
      .returns<HamperItemRow[]>(),
    supabase.from("categories").select("*").returns<Category[]>(),
    loadSettings(supabase),
  ]);

  const byHamper = new Map<string, ContentItem[]>();
  for (const item of items ?? []) {
    const list = byHamper.get(item.hamper_id) ?? [];
    list.push(item);
    byHamper.set(item.hamper_id, list);
  }

  return {
    hampers: (hampers ?? []).map((h) => ({ ...h, items: byHamper.get(h.id) ?? [] })),
    // Packaging is whatever Settings marks as not counting toward No. of Items.
    packagingCategories: (categories ?? []).filter((c) => !c.counts_as_item).map((c) => c.name),
    settings,
  };
}
