"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { describeError } from "@/lib/forms";
import type { ProductColor } from "@/lib/product-code";

// Every page under /cost-calculator reads the hierarchy, so refresh them all.
const refresh = () => revalidatePath("/cost-calculator", "layout");

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

  refresh();
  return { ok: true };
}

export async function deleteCostCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cost_categories").delete().eq("id", id);
  if (error) return { error: describeError(error) };
  refresh();
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

  refresh();
  return { ok: true };
}

export async function deleteCostSubcategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cost_subcategories").delete().eq("id", id);
  if (error) return { error: describeError(error) };
  refresh();
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

  refresh();
  return { ok: true };
}

export async function deleteCostVariety(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cost_varieties").delete().eq("id", id);
  if (error) return { error: describeError(error) };
  refresh();
  return { ok: true };
}

/** Saves the colour list and each colour's swatch, used everywhere colours show. */
export async function saveProductColors(colors: ProductColor[]) {
  const supabase = await createClient();
  const seen = new Set<string>();
  const cleaned = colors
    .map((c) => ({ ...c, name: c.name.trim() }))
    .filter((c) => c.name && !seen.has(c.name.toLowerCase()) && seen.add(c.name.toLowerCase()));
  const { error } = await supabase.from("app_settings").upsert(
    [
      { key: "product_colors", value: cleaned.map((c) => c.name) },
      { key: "color_hex", value: Object.fromEntries(cleaned.map((c) => [c.name, c.hex])) },
    ],
    { onConflict: "key" },
  );
  if (error) return { error: describeError(error) };
  refresh();
  revalidatePath("/products");
  return { ok: true };
}
