"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calculateCostSheetTotals, calculateLineCost } from "@/lib/costing.ts";
import { describeError } from "@/lib/forms";
import {
  formatProductCode,
  parseProductCode,
  getNextSerialForCategory,
  STANDARD_PRODUCT_COLORS,
} from "@/lib/product-code";
import type { ProductCostLine } from "@/lib/types";

export type SaveCostSheetPayload = {
  sheetId?: string | null;
  productId?: string | null;
  productCode: string;
  productName: string;
  categoryId?: string | null;
  source?: string | null;
  colors?: string[];
  isActive?: boolean;
  markupPct: number;
  sellingPrice?: number;
  notes?: string | null;
  createAllColorVariants?: boolean;
  lines: ProductCostLine[];
};

export async function saveCostSheetAndProduct(payload: SaveCostSheetPayload) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be signed in to save costing." };
    }

    const code = payload.productCode.trim();
    const name = payload.productName.trim();

    if (!code) return { error: "Product code is required." };
    if (!name) return { error: "Product name is required." };

    // Calculate line totals and grand totals
    const preparedLines: ProductCostLine[] = payload.lines.map((l, index) => {
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
        qty: Number(l.qty) || 1,
        wastage_pct: Number(l.wastage_pct) || 0,
        calculated_area: calc.calculated_area,
        line_total: calc.line_total,
        sort_order: index + 1,
      };
    });

    const totals = calculateCostSheetTotals(preparedLines, payload.markupPct);
    const finalSellingPrice =
      payload.sellingPrice != null && payload.sellingPrice > 0
        ? payload.sellingPrice
        : totals.calculated_sp;

    const targetMargin =
      finalSellingPrice > 0 ? (finalSellingPrice - totals.total_cost) / finalSellingPrice : 0;

    // 1. Save / Update Product in Product Master
    let productId = payload.productId;

    const productValues = {
      code,
      name,
      category_id: payload.categoryId || null,
      source: payload.source || null,
      cost_price: totals.total_cost,
      markup_pct: totals.markup_pct,
      target_margin: targetMargin,
      default_sp: finalSellingPrice,
      colors: payload.colors || [],
      is_active: payload.isActive !== false,
    };

    if (productId) {
      const { error: pErr } = await supabase
        .from("products")
        .update(productValues)
        .eq("id", productId);
      if (pErr) return { error: `Error updating product: ${describeError(pErr)}` };
    } else {
      // Check if product with code already exists
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("code", code)
        .maybeSingle();

      if (existing) {
        productId = existing.id;
        const { error: pErr } = await supabase
          .from("products")
          .update(productValues)
          .eq("id", productId);
        if (pErr) return { error: `Error updating existing product: ${describeError(pErr)}` };
      } else {
        const { data: inserted, error: pErr } = await supabase
          .from("products")
          .insert(productValues)
          .select("id")
          .single();
        if (pErr) return { error: `Error creating product: ${describeError(pErr)}` };
        productId = inserted.id;
      }
    }

    // 2. Save / Update Product Cost Sheet
    let sheetId = payload.sheetId;

    const sheetValues = {
      product_id: productId,
      product_code: code,
      product_name: name,
      material_total: totals.material_total,
      hardware_total: totals.hardware_total,
      finishing_total: totals.finishing_total,
      machine_total: totals.machine_total,
      total_cost: totals.total_cost,
      markup_pct: totals.markup_pct,
      calculated_sp: finalSellingPrice,
      notes: payload.notes || null,
      created_by: user.id,
    };

    if (sheetId) {
      const { error: sErr } = await supabase
        .from("product_cost_sheets")
        .update(sheetValues)
        .eq("id", sheetId);
      if (sErr) return { error: `Error updating cost sheet: ${describeError(sErr)}` };
    } else {
      // Check if a sheet for this product already exists
      const { data: existingSheet } = await supabase
        .from("product_cost_sheets")
        .select("id")
        .eq("product_id", productId)
        .maybeSingle();

      if (existingSheet) {
        sheetId = existingSheet.id;
        await supabase.from("product_cost_sheets").update(sheetValues).eq("id", sheetId);
      } else {
        const { data: insertedSheet, error: sErr } = await supabase
          .from("product_cost_sheets")
          .insert(sheetValues)
          .select("id")
          .single();
        if (sErr) return { error: `Error creating cost sheet: ${describeError(sErr)}` };
        sheetId = insertedSheet.id;
      }
    }

    // 3. Replace lines for this sheet
    await supabase.from("product_cost_lines").delete().eq("sheet_id", sheetId);

    if (preparedLines.length > 0) {
      const linesToInsert = preparedLines.map((line) => ({
        ...line,
        sheet_id: sheetId,
      }));

      const { error: lErr } = await supabase
        .from("product_cost_lines")
        .insert(linesToInsert);
      if (lErr) return { error: `Error saving cost lines: ${describeError(lErr)}` };
    }

    // 3.5. Optionally create / sync all 3 standard color variants (Walnut, Natural, Black)
    const createdVariants: string[] = [];
    if (payload.createAllColorVariants) {
      const parsed = parseProductCode(code);
      const catCode = parsed.categoryCode || "XX";
      const serial = parsed.serial || "0001";

      for (const col of STANDARD_PRODUCT_COLORS) {
        const variantCode = formatProductCode(catCode, serial, col.code);
        createdVariants.push(variantCode);

        const variantValues = {
          code: variantCode,
          name: name,
          category_id: payload.categoryId || null,
          source: payload.source || null,
          cost_price: totals.total_cost,
          markup_pct: totals.markup_pct,
          target_margin: targetMargin,
          default_sp: finalSellingPrice,
          colors: [col.name],
          is_active: payload.isActive !== false,
        };

        const { data: exVariant } = await supabase
          .from("products")
          .select("id")
          .eq("code", variantCode)
          .maybeSingle();

        if (exVariant) {
          await supabase.from("products").update(variantValues).eq("id", exVariant.id);
        } else {
          await supabase.from("products").insert(variantValues);
        }
      }
    }

    revalidatePath("/cost-calculator");
    revalidatePath("/products");
    revalidatePath(`/products/${encodeURIComponent(code)}`);
    revalidatePath("/hampers");

    return {
      ok: true,
      sheetId,
      productId,
      productCode: code,
      totalCost: totals.total_cost,
      sellingPrice: finalSellingPrice,
      variants: createdVariants.length > 0 ? createdVariants : undefined,
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getNextSerialAction(
  categoryCode: string,
): Promise<{ serial: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: products, error } = await supabase.from("products").select("code");
    if (error) return { serial: "0001", error: describeError(error) };
    const codes = (products ?? []).map((p: { code: string }) => p.code);
    const nextSerial = getNextSerialForCategory(categoryCode, codes);
    return { serial: nextSerial };
  } catch (err: unknown) {
    return { serial: "0001", error: describeError(err) };
  }
}

// ---------------------------------------------------------------
// HIERARCHY / MASTER ACTIONS
// ---------------------------------------------------------------

export async function saveCostCategory(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id")?.toString();
  const stage_id = formData.get("stage_id")?.toString();
  const name = formData.get("name")?.toString().trim();
  const sort_order = Number(formData.get("sort_order")) || 0;

  if (!stage_id) return { error: "Stage is required." };
  if (!name) return { error: "Category name is required." };

  if (id) {
    const { error } = await supabase
      .from("cost_categories")
      .update({ name, sort_order })
      .eq("id", id);
    if (error) return { error: describeError(error) };
  } else {
    const { error } = await supabase
      .from("cost_categories")
      .insert({ stage_id, name, sort_order });
    if (error) return { error: describeError(error) };
  }

  revalidatePath("/cost-calculator");
  return { ok: true };
}

export async function deleteCostCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cost_categories").delete().eq("id", id);
  if (error) return { error: describeError(error) };
  revalidatePath("/cost-calculator");
  return { ok: true };
}

export async function saveCostSubcategory(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id")?.toString();
  const category_id = formData.get("category_id")?.toString();
  const name = formData.get("name")?.toString().trim();
  const sort_order = Number(formData.get("sort_order")) || 0;

  if (!category_id) return { error: "Category is required." };
  if (!name) return { error: "Subcategory name is required (e.g. Birch, Acacia)." };

  if (id) {
    const { error } = await supabase
      .from("cost_subcategories")
      .update({ name, sort_order })
      .eq("id", id);
    if (error) return { error: describeError(error) };
  } else {
    const { error } = await supabase
      .from("cost_subcategories")
      .insert({ category_id, name, sort_order });
    if (error) return { error: describeError(error) };
  }

  revalidatePath("/cost-calculator");
  return { ok: true };
}

export async function deleteCostSubcategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cost_subcategories").delete().eq("id", id);
  if (error) return { error: describeError(error) };
  revalidatePath("/cost-calculator");
  return { ok: true };
}

export async function saveCostVariety(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id")?.toString();
  const subcategory_id = formData.get("subcategory_id")?.toString();
  const name = formData.get("name")?.toString().trim();
  const default_rate = Number(formData.get("default_rate")) || 0;
  const unit = formData.get("unit")?.toString().trim() || "sq ft";
  const default_wastage_pct = Number(formData.get("default_wastage_pct")) || 0;
  const notes = formData.get("notes")?.toString().trim() || null;
  const sort_order = Number(formData.get("sort_order")) || 0;

  if (!subcategory_id) return { error: "Subcategory is required." };
  if (!name) return { error: "Variety name is required (e.g. 8mm, 12mm)." };

  const values = {
    subcategory_id,
    name,
    default_rate,
    unit,
    default_wastage_pct,
    notes,
    sort_order,
  };

  if (id) {
    const { error } = await supabase.from("cost_varieties").update(values).eq("id", id);
    if (error) return { error: describeError(error) };
  } else {
    const { error } = await supabase.from("cost_varieties").insert(values);
    if (error) return { error: describeError(error) };
  }

  revalidatePath("/cost-calculator");
  return { ok: true };
}

export async function deleteCostVariety(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cost_varieties").delete().eq("id", id);
  if (error) return { error: describeError(error) };
  revalidatePath("/cost-calculator");
  return { ok: true };
}

export async function saveProductColors(colors: string[]) {
  const supabase = await createClient();
  const cleaned = Array.from(new Set(colors.map((c) => c.trim()).filter(Boolean)));
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "product_colors", value: cleaned }, { onConflict: "key" });
  if (error) return { error: describeError(error) };
  revalidatePath("/cost-calculator");
  revalidatePath("/products");
  return { ok: true };
}
