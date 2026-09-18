"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createClient, requireRole } from "@/lib/supabase/server";
import { type ActionState, checkbox, describeError, percent } from "@/lib/forms";
import { deriveCategoryCode } from "@/lib/product-code";

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
  legal_name: z.string().trim(),
  address: z.string().trim(),
  gstin: z.string().trim(),
  phone: z.string().trim(),
  email: z.string().trim(),
  website: z.string().trim(),
  bank_account_name: z.string().trim(),
  bank_name: z.string().trim(),
  bank_account_no: z.string().trim(),
  bank_ifsc: z.string().trim().toUpperCase(),
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

// ---------------------------------------------------------------
// DESKTOP APP
// ---------------------------------------------------------------

/**
 * Starts .github/workflows/desktop.yml, which builds the Windows app from main
 * and publishes it; installed apps then offer "Update now" on their next launch.
 * Needs the Worker secret GITHUB_TOKEN: a fine-grained token for this repo
 * with Actions: Read and write.
 */
export async function publishDesktopApp(): Promise<ActionState> {
  await requireRole("admin");

  let token = process.env.GITHUB_TOKEN;
  try {
    const { env } = await getCloudflareContext({ async: true });
    token ??= (env as unknown as { GITHUB_TOKEN?: string }).GITHUB_TOKEN;
  } catch {
    // Not on Cloudflare (desktop app, local dev): process.env only.
  }
  if (!token) return { error: "GITHUB_TOKEN is not set on the website." };

  const res = await fetch(
    "https://api.github.com/repos/TheWhiteTusker/Lattice-Lane-Hamper-Builder/actions/workflows/desktop.yml/dispatches",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "user-agent": "lattice-lane",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );
  if (!res.ok) return { error: `GitHub refused (${res.status}): ${await res.text()}` };

  return { ok: true };
}
