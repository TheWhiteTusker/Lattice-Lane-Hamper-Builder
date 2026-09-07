"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type ActionState, describeError } from "@/lib/forms";

export async function applyRefresh(): Promise<ActionState> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("refresh_hamper_prices", { p_apply: true });
  if (error) return { error: describeError(error) };

  const applied = (data ?? []).filter(
    (row: { note: string }) => row.note === "changed",
  ).length;

  // Hamper totals come from a view, so nothing else needs recalculating.
  revalidatePath("/hampers");
  redirect(`/admin/refresh-prices?applied=${applied}`);
}
