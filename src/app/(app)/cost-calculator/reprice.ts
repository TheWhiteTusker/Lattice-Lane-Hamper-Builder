import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateCostSheetTotals, calculateLineCost, scaledPrice } from "@/lib/costing.ts";
import { describeError } from "@/lib/forms";
import { parseProductCode } from "@/lib/product-code";
import type { ProductCostLine, ProductCostSheet } from "@/lib/types";

/**
 * The products a cost sheet prices: its own product, plus the colour
 * siblings saved from it (LC/0001/WL -> LC/0001/BL), unless a sibling has
 * since been costed on a sheet of its own.
 */
async function productsOfSheet(supabase: SupabaseClient, sheet: ProductCostSheet) {
  const ids = new Set<string>(sheet.product_id ? [sheet.product_id] : []);
  const { categoryCode, serial, isValid } = parseProductCode(sheet.product_code ?? "");
  if (!isValid) return [...ids];

  const { data } = await supabase.from("products").select("id").like("code", `${categoryCode}/${serial}/%`);
  const candidates = (data ?? []).map((p: { id: string }) => p.id).filter((id) => !ids.has(id));
  if (candidates.length) {
    const { data: own } = await supabase.from("product_cost_sheets").select("product_id").in("product_id", candidates);
    const costedAlone = new Set((own ?? []).map((s: { product_id: string }) => s.product_id));
    for (const id of candidates) if (!costedAlone.has(id)) ids.add(id);
  }
  return [...ids];
}

/**
 * After a master rate changes: re-rate every saved line using that variety,
 * recompute those cost sheets (with their overheads), and reprice their
 * products, scaling each selling price with its cost so the margin holds. Quotations, proforma invoices and
 * hampers keep their own saved prices and are not touched.
 *
 * ponytail: several statements, not one transaction; move into an RPC if a
 * half-applied reprice (network drop mid-way) becomes a real problem.
 */
export async function repriceVariety(
  supabase: SupabaseClient,
  varietyId: string,
): Promise<{ products: number; error?: string }> {
  const { data: v } = await supabase
    .from("cost_varieties")
    .select("name, default_rate, unit, cost_subcategories(name, cost_categories(name))")
    .eq("id", varietyId)
    .maybeSingle<{
      name: string;
      default_rate: number;
      unit: string;
      cost_subcategories: { name: string; cost_categories: { name: string } | null } | null;
    }>();
  if (!v) return { products: 0, error: "That variety no longer exists." };
  const rate = Number(v.default_rate);
  const unit = v.unit;
  const sub = v.cost_subcategories;
  // Lines also take the master's current names, so renames show everywhere.
  const names = {
    ...(sub?.cost_categories ? { category_name: sub.cost_categories.name } : {}),
    ...(sub ? { subcategory_name: sub.name, item_name: `${sub.name} ${v.name}` } : {}),
    variety_name: v.name,
  };

  const { data: used, error } = await supabase
    .from("product_cost_lines")
    .select("*")
    .eq("cost_variety_id", varietyId)
    .returns<ProductCostLine[]>();
  if (error) return { products: 0, error: describeError(error) };
  if (!used?.length) return { products: 0 };

  // 1. The lines themselves
  const lineResults = await Promise.all(
    used.map((l) => {
      const calc = calculateLineCost({ ...l, rate, unit });
      return supabase
        .from("product_cost_lines")
        .update({ ...names, rate, unit, calculated_area: calc.calculated_area, line_total: calc.line_total })
        .eq("id", l.id!);
    }),
  );
  const lineError = lineResults.find((r) => r.error)?.error;
  if (lineError) return { products: 0, error: describeError(lineError) };

  // 2. Each affected sheet, with all of its (now updated) lines
  const sheetIds = [...new Set(used.map((l) => l.sheet_id!))];
  const [{ data: sheets }, { data: lines }] = await Promise.all([
    supabase.from("product_cost_sheets").select("*").in("id", sheetIds).returns<ProductCostSheet[]>(),
    supabase.from("product_cost_lines").select("*").in("sheet_id", sheetIds).returns<ProductCostLine[]>(),
  ]);

  let products = 0;
  for (const sheet of sheets ?? []) {
    const t = calculateCostSheetTotals(
      (lines ?? []).filter((l) => l.sheet_id === sheet.id),
      sheet.markup_pct,
      sheet.stage_overheads ?? {},
    );

    // 3. The products: price scales with cost, so each keeps its margin
    const ids = await productsOfSheet(supabase, sheet);
    const { data: current } = await supabase
      .from("products")
      .select("id, cost_price, default_sp")
      .in("id", ids)
      .returns<{ id: string; cost_price: number; default_sp: number }[]>();
    const priced = (current ?? []).map((p) => ({ id: p.id, sp: scaledPrice(p.cost_price, p.default_sp, t.total_cost, t.calculated_sp) }));
    const results = await Promise.all(
      priced.map(({ id, sp }) =>
        supabase
          .from("products")
          .update({ cost_price: t.total_cost, default_sp: sp, target_margin: sp > 0 ? (sp - t.total_cost) / sp : 0 })
          .eq("id", id),
      ),
    );
    const productError = results.find((r) => r.error)?.error;
    if (productError) return { products, error: describeError(productError) };
    products += priced.length;

    // The sheet records the price its own product now sells at.
    const { error: sheetError } = await supabase
      .from("product_cost_sheets")
      .update({
        material_total: t.material_total,
        hardware_total: t.hardware_total,
        finishing_total: t.finishing_total,
        machine_total: t.machine_total,
        total_cost: t.total_cost,
        calculated_sp: priced.find((p) => p.id === sheet.product_id)?.sp ?? t.calculated_sp,
      })
      .eq("id", sheet.id);
    if (sheetError) return { products, error: describeError(sheetError) };
  }
  return { products };
}
