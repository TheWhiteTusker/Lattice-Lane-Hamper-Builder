"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionState,
  optionalText,
  money,
  percent,
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
  target_margin: percent,
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

  const { id, ...values } = parsed.data;
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from("products").update(values).eq("id", id)
    : await supabase.from("products").insert(values);

  if (error) return { error: describeError(error) };

  revalidatePath("/products");
  redirect(`/products?saved=${encodeURIComponent(values.code)}`);
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
