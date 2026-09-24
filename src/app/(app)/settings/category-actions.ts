"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type ActionState, checkbox, describeError } from "@/lib/forms";
import { deriveCategoryCode } from "@/lib/product-code";

// ---------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------

export async function saveCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Category name is required." };

  const rawCode = String(formData.get("code") ?? "").trim().toUpperCase();
  const code = rawCode || deriveCategoryCode(name);

  const values = {
    name,
    code,
    counts_as_item: checkbox.parse(formData.get("counts_as_item") ?? undefined),
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
  };

  const supabase = await createClient();

  const { error } = id
    ? await supabase.from("categories").update(values).eq("id", id)
    : await supabase.from("categories").insert(values);

  if (error) return { error: describeError(error) };

  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing category." };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);

  // Products reference categories, so a category in use cannot be removed.
  if (error) {
    return {
      error: describeError(error) + " Move its products to another category first.",
    };
  }

  revalidatePath("/settings");
  return { ok: true };
}

// ---------------------------------------------------------------
// USERS
// ---------------------------------------------------------------

export async function setUserRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!["admin", "manager", "sales"].includes(role)) {
    return { error: "Unknown role." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Without this an admin could demote themselves and lock everyone out of
  // Product Master and Settings.
  if (user?.id === id && role !== "admin") {
    return { error: "You cannot remove your own admin access. Ask another admin to do it." };
  }

  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) return { error: describeError(error) };

  revalidatePath("/settings");
  return { ok: true };
}
