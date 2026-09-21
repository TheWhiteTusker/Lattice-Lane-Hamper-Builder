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

/** Add a single item to a pick-list in app_settings. */
export async function addPickListItem(
  key: string,
  rawItem: string,
): Promise<ActionState & { values?: string[] }> {
  const trimmed = rawItem.trim();
  if (!key) return { error: "Missing list key." };
  if (!trimmed) return { error: "Item name cannot be empty." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) return { error: describeError(error) };

  const current: string[] = Array.isArray(data?.value) ? (data.value as string[]) : [];
  if (current.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
    return { error: `"${trimmed}" already exists in this pick-list.` };
  }

  const updated = [...current, trimmed];
  const res = await saveSetting(key, updated);
  if (res.error) return res;

  return { ok: true, values: updated };
}

/** Remove a single item from a pick-list in app_settings. */
export async function removePickListItem(
  key: string,
  item: string,
): Promise<ActionState & { values?: string[] }> {
  if (!key) return { error: "Missing list key." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) return { error: describeError(error) };

  const current: string[] = Array.isArray(data?.value) ? (data.value as string[]) : [];
  const updated = current.filter((v) => v !== item);
  const res = await saveSetting(key, updated);
  if (res.error) return res;

  return { ok: true, values: updated };
}

/** Persist an entire list of values for a pick-list key. */
export async function setPickListValues(
  key: string,
  values: string[],
): Promise<ActionState> {
  if (!key) return { error: "Missing list key." };
  const cleaned = values.map((v) => v.trim()).filter(Boolean);
  return saveSetting(key, cleaned);
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
const WORKFLOW = "https://api.github.com/repos/TheWhiteTusker/hamper-builder/actions/workflows/desktop.yml";

async function githubToken() {
  let token = process.env.GITHUB_TOKEN;
  try {
    const { env } = await getCloudflareContext({ async: true });
    token ??= (env as unknown as { GITHUB_TOKEN?: string }).GITHUB_TOKEN;
  } catch {
    // Not on Cloudflare (desktop app, local dev): process.env only.
  }
  return token;
}

const githubHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "user-agent": "lattice-lane",
});

export async function publishDesktopApp(): Promise<ActionState> {
  await requireRole("admin");
  const token = await githubToken();
  if (!token) return { error: "GITHUB_TOKEN is not set on the website." };

  const res = await fetch(`${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: githubHeaders(token),
    body: JSON.stringify({ ref: "main" }),
  });
  if (!res.ok) return { error: `GitHub refused (${res.status}): ${await res.text()}` };

  return { ok: true };
}

export type ReleaseStatus = {
  state: "running" | "success" | "failure" | "idle";
  percent: number;
  step?: string;
  url?: string;
  createdAt?: string;
};

type Run = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  run_started_at: string;
  updated_at: string;
  html_url: string;
};

/**
 * Progress of the latest desktop release. GitHub gives no percentage, so it is
 * estimated from elapsed time against the last successful run's duration, and
 * held at 99% until GitHub reports the run finished.
 */
export async function desktopReleaseStatus(): Promise<ReleaseStatus> {
  await requireRole("admin");
  const token = await githubToken();
  if (!token) return { state: "idle", percent: 0 };
  const headers = githubHeaders(token);

  const res = await fetch(`${WORKFLOW}/runs?per_page=10`, { headers, cache: "no-store" });
  if (!res.ok) return { state: "idle", percent: 0 };
  const runs = ((await res.json()) as { workflow_runs: Run[] }).workflow_runs;
  const run = runs[0];
  if (!run) return { state: "idle", percent: 0 };

  if (run.status === "completed") {
    return {
      state: run.conclusion === "success" ? "success" : "failure",
      percent: run.conclusion === "success" ? 100 : 0,
      url: run.html_url,
      createdAt: run.created_at,
    };
  }

  const lastGood = runs.find((r) => r.status === "completed" && r.conclusion === "success");
  const expectedMs = lastGood
    ? Date.parse(lastGood.updated_at) - Date.parse(lastGood.run_started_at)
    : 10 * 60_000;
  const elapsedMs = Date.now() - Date.parse(run.run_started_at);
  const percent = Math.min(99, Math.max(1, Math.round((elapsedMs / expectedMs) * 100)));

  let step: string | undefined;
  const jobs = await fetch(`https://api.github.com/repos/TheWhiteTusker/hamper-builder/actions/runs/${run.id}/jobs`, {
    headers,
    cache: "no-store",
  });
  if (jobs.ok) {
    const { jobs: list } = (await jobs.json()) as { jobs: { steps?: { name: string; status: string }[] }[] };
    step = list[0]?.steps?.find((s) => s.status === "in_progress")?.name;
  }

  return {
    state: "running",
    percent: run.status === "queued" ? 0 : percent,
    step,
    url: run.html_url,
    createdAt: run.created_at,
  };
}
