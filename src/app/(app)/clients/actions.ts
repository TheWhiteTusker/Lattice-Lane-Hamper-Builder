"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
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
    return { error: describeError(error) };
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

/** Company name and address for a GSTIN, from gstinapi.in. */
export async function lookupGstin(
  gstin: string,
): Promise<{ error?: string; details?: GstDetails }> {
  await requireUser();

  const value = gstin.trim().toUpperCase();
  if (!GSTIN.test(value)) return { error: "Enter a valid 15-character GSTIN first." };

  let key = process.env.GSTIN_API_KEY?.trim() || undefined;
  try {
    const { env } = await getCloudflareContext({ async: true });
    key ??= (env as unknown as { GSTIN_API_KEY?: string })?.GSTIN_API_KEY?.trim() || undefined;
  } catch {
    // Not on Cloudflare
  }

  if (!key) return { error: "GST lookup is not configured. Enter the name and address by hand." };

  let response: Response;
  try {
    // ponytail: one attempt. The API asks for backoff on 429/502, which is
    // worth adding only if this stops being a button someone presses by hand.
    response = await fetch(`https://www.gstinapi.in/v1/gstin/${value}`, {
      headers: { "x-api-key": key },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { error: "Could not reach the GST service. Enter the details by hand." };
  }

  // Parsed leniently on purpose: the API adds fields without notice.
  const body = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: string | Record<string, unknown>;
    data?: Record<string, string | null>;
  } | null;

  if (!response.ok || !body?.success || !body.data) {
    let errMsg = "GST lookup failed. Enter the details by hand.";
    if (typeof body?.error === "string") {
      errMsg = body.error;
    } else if (body?.error && typeof body.error === "object") {
      const errObj = body.error as Record<string, unknown>;
      errMsg = String(errObj.message || errObj.error || errMsg);
    }
    return { error: errMsg };
  }

  const { trade_name, legal_name, address, pincode } = body.data;

  return {
    details: {
      name: trade_name || legal_name || "",
      billing_address: [address, pincode].filter(Boolean).join(" - "),
    },
  };
}
