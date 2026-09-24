import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateLineCost } from "@/lib/costing.ts";
import { describeError } from "@/lib/forms";
import { codesForColors } from "@/lib/product-code";
import type { ProductCostLine } from "@/lib/types";

/** Cost lines as stored: recomputed totals, coerced numbers, 1-based order. */
export function prepareLines(lines: ProductCostLine[]): ProductCostLine[] {
  return lines.map((l, index) => {
    const calc = calculateLineCost(l);
    const subName = l.subcategory_name || "";
    const varName = l.variety_name || "";
    const itemName =
      l.item_name || (subName && varName ? `${subName} ${varName}` : subName || varName);

    return {
      stage_code: l.stage_code,
      category_name: l.category_name,
      subcategory_name: subName || null,
      variety_name: varName || null,
      item_name: itemName,
      cost_item_id: l.cost_item_id || null,
      cost_variety_id: l.cost_variety_id || null,
      length: l.length != null ? Number(l.length) : null,
      breadth: l.breadth != null ? Number(l.breadth) : null,
      dimension_unit: l.dimension_unit || "inch",
      unit: l.unit || "sq ft",
      rate: Number(l.rate) || 0,
      duration_minutes: l.duration_minutes != null ? Number(l.duration_minutes) : null,
      qty: l.qty != null ? Number(l.qty) : 1,
      wastage_pct: Number(l.wastage_pct) || 0,
      calculated_area: calc.calculated_area,
      line_total: calc.line_total,
      sort_order: index + 1,
    };
  });
}

/**
 * Update the row with `id`; without one, update the row whose `match` column
 * equals the value, or insert. Returns the row's id, or the error.
 */
export async function saveRow(
  supabase: SupabaseClient,
  table: string,
  values: Record<string, unknown>,
  id: string | null | undefined,
  [column, value]: [string, string],
): Promise<{ id: string; error?: undefined } | { id?: undefined; error: string }> {
  if (!id) {
    const { data } = await supabase.from(table).select("id").eq(column, value).maybeSingle();
    id = data?.id as string | undefined;
  }
  if (id) {
    const { error } = await supabase.from(table).update(values).eq("id", id);
    return error ? { error: describeError(error) } : { id };
  }
  const { data, error } = await supabase.from(table).insert(values).select("id").single();
  return error || !data ? { error: describeError(error) } : { id: data.id as string };
}

/**
 * One sibling product per extra colour, same costing and price. Saved by
 * code, so re-saving updates rather than duplicates.
 */
export async function saveColorVariants(
  supabase: SupabaseClient,
  code: string,
  productId: string,
  colors: string[],
  productValues: Record<string, unknown>,
) {
  const variants: { color: string; code: string; id: string }[] = [];
  if (colors[0]) variants.push({ color: colors[0], code, id: productId });
  for (const { color, code: variantCode } of codesForColors(code, colors.slice(1))) {
    if (variantCode === code) continue;
    const values = { ...productValues, code: variantCode, colors: [color] };
    const saved = await saveRow(supabase, "products", values, null, ["code", variantCode]);
    if (saved.error !== undefined) return { error: `Error saving ${variantCode}: ${saved.error}` };
    variants.push({ color, code: variantCode, id: saved.id });
  }
  return { variants };
}
