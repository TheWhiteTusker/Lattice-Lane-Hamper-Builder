"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type ActionState, checkbox, describeError, percent } from "@/lib/forms";

async function saveSetting(key: string, value: unknown): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert({ key, value }, { onConflict: "key" });

  if (error) return { error: describeError(error) };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------
// COMPANY + TAX
// ---------------------------------------------------------------

const CompanySchema = z.object({
  name: z.string().trim().min(1, "Company name is required"),
  address: z.string().trim(),
  gstin: z.string().trim(),
  phone: z.string().trim(),
  email: z.string().trim(),
  website: z.string().trim(),
});

export async function saveCompany(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = CompanySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const company = await saveSetting("company", parsed.data);
  if (company.error) return company;

  const gst = percent.safeParse(String(formData.get("gst_rate") ?? ""));
  if (gst.success) {
    const rate = await saveSetting("gst_rate", gst.data);
    if (rate.error) return rate;
  }

  return { ok: true };
}

export async function saveTerms(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return saveSetting("quote_terms", String(formData.get("quote_terms") ?? ""));
}

// ---------------------------------------------------------------
// PICK-LISTS
// ---------------------------------------------------------------

/** One value per line, blank lines dropped. */
export async function saveList(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const key = String(formData.get("key") ?? "");
  if (!key) return { error: "Missing list." };

  const values = String(formData.get("values") ?? "")
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  return saveSetting(key, values);
}

export async function saveDefault(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const key = String(formData.get("key") ?? "");
  if (!key) return { error: "Missing setting." };

  return saveSetting(key, String(formData.get("value") ?? ""));
}

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

  const values = {
    name,
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
