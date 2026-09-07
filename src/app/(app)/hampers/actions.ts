"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type ActionState, describeError } from "@/lib/forms";

const nullableText = z.string().trim().nullable().optional();

const LineSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  product_code: nullableText,
  product_name: z.string().trim().min(1),
  category_name: nullableText,
  source: nullableText,
  qty: z.number(),
  unit_cp: z.number(),
  unit_sp: z.number(),
  target_margin: z.number(),
});

const HamperSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, "Hamper name is required"),
  collection: nullableText,
  status: z.string().trim().default("Draft"),
  target_sp: z.number().nullable().optional(),
  notes: nullableText,
  discount_pct: z.number().default(0),
  final_catalogue_sp: z.number().nullable().optional(),
  lines: z.array(LineSchema).min(1, "Add at least one product to the hamper"),
});

export async function saveHamper(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let payload: unknown;

  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { error: "Could not read the hamper. Please try again." };
  }

  const parsed = HamperSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // The spreadsheet refused to save without a Final Catalogue SP. That makes
  // sense for a hamper going into a catalogue, but not for one still being
  // costed - so the rule applies only once it leaves Draft.
  if (parsed.data.status !== "Draft" && parsed.data.final_catalogue_sp == null) {
    return {
      error: `A Final Catalogue SP is required before a hamper can be marked ${parsed.data.status}.`,
    };
  }

  const supabase = await createClient();
  const { data: code, error } = await supabase.rpc("save_hamper", { p: parsed.data });

  if (error) return { error: describeError(error) };

  revalidatePath("/hampers");
  redirect(`/hampers/${encodeURIComponent(String(code))}?saved=1`);
}

export async function duplicateHamper(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = String(formData.get("code") ?? "");
  if (!code) return { error: "Missing hamper." };

  const supabase = await createClient();
  const { data: newCode, error } = await supabase.rpc("duplicate_hamper", {
    p_code: code,
  });

  if (error) return { error: describeError(error) };

  revalidatePath("/hampers");
  redirect(`/hampers/${encodeURIComponent(String(newCode))}?duplicated=${encodeURIComponent(code)}`);
}

export async function deleteHamper(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing hamper." };

  const supabase = await createClient();

  // Quote lines keep hamper_code and the price they were quoted at, so past
  // quotations stay intact when a hamper is retired.
  const { error } = await supabase.from("hampers").delete().eq("id", id);
  if (error) return { error: describeError(error) };

  revalidatePath("/hampers");
  redirect("/hampers?deleted=1");
}
