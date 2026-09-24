import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CostCategory,
  CostStage,
  CostStageWithHierarchy,
  CostSubcategory,
  CostVariety,
  Product,
  ProductCostLine,
  ProductCostSheet,
  ProductImage,
} from "@/lib/types";

function groupBy<T>(rows: T[] | null, key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows ?? []) map.set(key(row), [...(map.get(key(row)) ?? []), row]);
  return map;
}

const active = <T,>(supabase: SupabaseClient, table: string) =>
  supabase.from(table).select("*").eq("is_active", true).order("sort_order").returns<T[]>();

/** The 4-level costing hierarchy: stage -> category -> subcategory -> variety. */
export async function loadCostStages(supabase: SupabaseClient): Promise<CostStageWithHierarchy[]> {
  const [{ data: stages }, { data: categories }, { data: subcategories }, { data: varieties }] =
    await Promise.all([
      active<CostStage>(supabase, "cost_stages"),
      active<CostCategory>(supabase, "cost_categories"),
      active<CostSubcategory>(supabase, "cost_subcategories"),
      active<CostVariety>(supabase, "cost_varieties"),
    ]);

  const varietiesBySub = groupBy(varieties, (v) => v.subcategory_id);
  const subsByCat = groupBy(
    (subcategories ?? []).map((sub) => ({ ...sub, varieties: varietiesBySub.get(sub.id) ?? [] })),
    (sub) => sub.category_id,
  );
  const catsByStage = groupBy(
    (categories ?? []).map((cat) => ({ ...cat, subcategories: subsByCat.get(cat.id) ?? [] })),
    (cat) => cat.stage_id,
  );
  return (stages ?? []).map((stage) => ({ ...stage, categories: catsByStage.get(stage.id) ?? [] }));
}

/** A product with its cost sheet (and lines) and photos, or null if the code is unknown. */
export async function loadProductCosting(supabase: SupabaseClient, code: string) {
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("code", code)
    .is("deleted_at", null)
    .maybeSingle<Product>();
  if (!product) return null;

  const [{ data: sheet }, { data: images }] = await Promise.all([
    supabase
      .from("product_cost_sheets")
      .select("*")
      .eq("product_id", product.id)
      .maybeSingle<ProductCostSheet>(),
    supabase
      .from("product_images")
      .select("*")
      .eq("product_id", product.id)
      .is("deleted_at", null)
      .order("sort_order")
      .order("created_at")
      .returns<ProductImage[]>(),
  ]);

  let lines: ProductCostLine[] = [];
  if (sheet) {
    const { data } = await supabase
      .from("product_cost_lines")
      .select("*")
      .eq("sheet_id", sheet.id)
      .order("sort_order")
      .returns<ProductCostLine[]>();
    lines = data ?? [];
  }

  return { product, sheet: sheet ? { ...sheet, lines } : null, images: images ?? [] };
}
