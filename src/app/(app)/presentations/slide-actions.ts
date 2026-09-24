"use server";

import { createClient } from "@/lib/supabase/server";
import { describeError } from "@/lib/forms";
import { CanvasSchema } from "@/lib/hamper-canvas";
import type { ActionResult } from "@/components/studio/editor";

const BUCKET = "product-images";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function touch(supabase: Supabase, presentationId: string) {
  // The trigger sets updated_at; any update fires it.
  await supabase.from("presentations").update({ updated_at: new Date().toISOString() }).eq("id", presentationId);
}

/* ---------------------------------------------------- photo editor actions */

/** Bind presentationId and slideId. */
export async function saveSlide(presentationId: string, slideId: string, formData: FormData): Promise<ActionResult> {
  try {
    let raw: unknown;
    try {
      raw = JSON.parse(String(formData.get("canvas") ?? ""));
    } catch {
      return { error: "Could not read the design." };
    }
    const canvas = CanvasSchema.safeParse(raw);
    if (!canvas.success) return { error: `Invalid design: ${canvas.error.issues[0].message}` };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("presentation_slides")
      .update({ canvas: canvas.data })
      .eq("id", slideId)
      .eq("presentation_id", presentationId)
      .select("id");
    if (error || !data?.length) return { error: error ? describeError(error) : "This slide no longer exists." };

    await touch(supabase, presentationId);
    return { ok: true };
  } catch (err) {
    return { error: describeError(err) };
  }
}

/** Bind presentationId. Uploads a background image for any slide of the deck. */
export async function uploadPresentationAsset(presentationId: string, formData: FormData): Promise<ActionResult> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Please choose an image." };
    if (!file.type.startsWith("image/")) return { error: "That file is not an image." };

    const supabase = await createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `presentations/${presentationId}/asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) return { error: `Storage upload failed: ${describeError(error)}` };
    return { ok: true, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
  } catch (err) {
    return { error: describeError(err) };
  }
}
