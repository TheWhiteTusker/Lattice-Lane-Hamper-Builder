"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { type ActionState, optionalText, describeError } from "@/lib/forms";

/** 2-digit state code, PAN, entity number, "Z", checksum. */
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const ClientSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1, "Company name is required"),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v || null)
    .refine((v) => !v || GSTIN.test(v), "That GSTIN does not look right (15 characters)."),
  billing_address: optionalText,
  contact_person: optionalText,
  phone: optionalText,
  email: optionalText,
});

export async function saveClient(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = ClientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, ...values } = parsed.data;
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from("clients").update(values).eq("id", id)
    : await supabase.from("clients").insert(values);

  if (error) {
    return {
      error: /duplicate key/i.test(error.message)
        ? "A client with that GSTIN already exists."
        : describeError(error),
    };
  }

  revalidatePath("/clients");
  redirect("/clients?saved=1");
}

export async function deleteClient(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing client." };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { error: describeError(error) };

  revalidatePath("/clients");
  redirect("/clients");
}

export type GstDetails = { name: string; billing_address: string };

/**
 * Company name and address for a GSTIN.
 *
 * ponytail: not connected yet. Call the GST API here and return
 * { details: { name, billing_address } } - the client form already fills
 * both fields from whatever this returns.
 */
export async function lookupGstin(
  gstin: string,
): Promise<{ error?: string; details?: GstDetails }> {
  await requireUser();

  const value = gstin.trim().toUpperCase();
  if (!GSTIN.test(value)) return { error: "Enter a valid 15-character GSTIN first." };

  return { error: "GST lookup is not connected yet. Enter the name and address by hand." };
}
