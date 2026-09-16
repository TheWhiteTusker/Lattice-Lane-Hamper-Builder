"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { codesForColors } from "@/lib/product-code";
import {
  type ActionState,
  optionalText,
  money,
  checkbox,
  describeError,
} from "@/lib/forms";

const ProductSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  code: z.string().trim().min(1, "Product code is required"),
  name: z.string().trim().min(1, "Product name is required"),
  category_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  source: optionalText,
  cost_price: money,
  markup_pct: z.coerce.number().default(0),
  default_sp: money,
  colors: z.array(z.string()).default([]),
  is_active: checkbox,
});

export async function saveProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawData: Record<string, unknown> = Object.fromEntries(formData);
  rawData.colors = formData.getAll("colors").map(String).filter(Boolean);

  const parsed = ProductSchema.safeParse(rawData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { id, ...fields } = parsed.data;
  // Margin is no longer entered on the form; it is still stored because hamper
  // costing snapshots it, so keep it in step with the price actually set.
  const values = {
    ...fields,
    target_margin: fields.default_sp > 0 ? Math.round(((fields.default_sp - fields.cost_price) / fields.default_sp) * 10000) / 10000 : 0,
  };
  const supabase = await createClient();

  // A new product in several colours becomes one row per colour, each with its
  // own code (LC/0001/WL, LC/0001/BL). Editing an existing product stays one row.
  const rows =
    id || values.colors.length < 2
      ? [values]
      : codesForColors(values.code, values.colors).map(({ color, code }) => ({
          ...values,
          code,
          colors: [color],
        }));

  const { error } = id
    ? await supabase.from("products").update(values).eq("id", id)
    : await supabase.from("products").insert(rows);

  if (error) return { error: describeError(error) };

  revalidatePath("/products");
  redirect(`/products?saved=${encodeURIComponent(rows.map((r) => r.code).join(", "))}`);
}

export async function deleteProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing product." };

  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);

  // A product used by a saved hamper cannot be deleted outright - the snapshot
  // on hamper_items keeps the history, so retiring it is the right move.
  if (error) {
    return {
      error:
        describeError(error) +
        " Mark it inactive instead - saved hampers keep their own copy of the price.",
    };
  }

  revalidatePath("/products");
  redirect("/products?deleted=1");
}

export async function toggleProductActive(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "") === "true";

  const supabase = await createClient();
  await supabase.from("products").update({ is_active: next }).eq("id", id);

  revalidatePath("/products");
}
