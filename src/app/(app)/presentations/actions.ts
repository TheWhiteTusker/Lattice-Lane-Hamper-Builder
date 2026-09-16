"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type ActionState, describeError } from "@/lib/forms";
import { CanvasSchema, type HamperCanvas } from "@/lib/hamper-canvas";
import {
  blankSlide,
  closingSlide,
  coverSlide,
  hamperSlide,
  productSlide,
  type HamperInfo,
  type ProductInfo,
} from "@/lib/presentation";
import type { ActionResult } from "@/components/studio/editor";

const BUCKET = "product-images";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const ItemSchema = z.object({ type: z.enum(["hamper", "product"]), id: z.string().uuid() });
export type DeckItem = z.infer<typeof ItemSchema>;

type SlideRow = {
  kind: "cover" | "hamper" | "product" | "closing" | "blank";
  hamper_id: string | null;
  product_id: string | null;
  canvas: HamperCanvas;
};

/** One generated slide per picked hamper/product, in the order picked. */
async function itemSlides(supabase: Supabase, items: DeckItem[]): Promise<SlideRow[]> {
  const hamperIds = items.filter((i) => i.type === "hamper").map((i) => i.id);
  const productIds = items.filter((i) => i.type === "product").map((i) => i.id);

  const hampers = hamperIds.length
    ? (
        await supabase
          .from("hamper_summary")
          .select("id, code, name, collection, final_catalogue_sp, image_url")
          .in("id", hamperIds)
          .returns<{ id: string; code: string; name: string; collection: string | null; final_catalogue_sp: number | null; image_url: string | null }[]>()
      ).data ?? []
    : [];
  const contents = hamperIds.length
    ? (
        await supabase
          .from("hamper_items")
          .select("hamper_id, product_name, qty")
          .in("hamper_id", hamperIds)
          .order("line_no")
          .returns<{ hamper_id: string; product_name: string; qty: number }[]>()
      ).data ?? []
    : [];
  const products = productIds.length
    ? (
        await supabase
          .from("products")
          .select("id, code, name, default_sp, image_url, colors")
          .in("id", productIds)
          .returns<{ id: string; code: string; name: string; default_sp: number | null; image_url: string | null; colors: string[] | null }[]>()
      ).data ?? []
    : [];

  return items.flatMap((item): SlideRow[] => {
    if (item.type === "hamper") {
      const h = hampers.find((x) => x.id === item.id);
      if (!h) return [];
      const info: HamperInfo = {
        id: h.id,
        code: h.code,
        name: h.name,
        collection: h.collection,
        price: h.final_catalogue_sp == null ? null : Number(h.final_catalogue_sp),
        image_url: h.image_url,
        contents: contents.filter((c) => c.hamper_id === h.id).map((c) => ({ name: c.product_name, qty: Number(c.qty) })),
      };
      return [{ kind: "hamper", hamper_id: h.id, product_id: null, canvas: hamperSlide(info) }];
    }
    const p = products.find((x) => x.id === item.id);
    if (!p) return [];
    const info: ProductInfo = {
      id: p.id,
      code: p.code,
      name: p.name,
      price: p.default_sp == null ? null : Number(p.default_sp),
      image_url: p.image_url,
      colors: p.colors ?? [],
    };
    return [{ kind: "product", hamper_id: null, product_id: p.id, canvas: productSlide(info) }];
  });
}

const CreateSchema = z.object({
  title: z.string().trim().min(1, "Give the presentation a title"),
  subtitle: z.string().trim().default(""),
  closingTitle: z.string().trim().default(""),
  closingText: z.string().trim().default(""),
  items: z.array(ItemSchema).min(1, "Pick at least one hamper or product"),
});

export async function createPresentation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { error: "Could not read the form. Please try again." };
  }
  const parsed = CreateSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: deck, error } = await supabase
    .from("presentations")
    .insert({ title: d.title })
    .select("id")
    .single<{ id: string }>();
  if (error || !deck) return { error: describeError(error) };

  const slides: SlideRow[] = [
    { kind: "cover", hamper_id: null, product_id: null, canvas: coverSlide(d.title, d.subtitle) },
    ...(await itemSlides(supabase, d.items)),
    { kind: "closing", hamper_id: null, product_id: null, canvas: closingSlide(d.closingTitle, d.closingText) },
  ];
  const { error: slideError } = await supabase
    .from("presentation_slides")
    .insert(slides.map((s, position) => ({ ...s, presentation_id: deck.id, position })));
  if (slideError) {
    await supabase.from("presentations").delete().eq("id", deck.id);
    return { error: describeError(slideError) };
  }

  revalidatePath("/presentations");
  redirect(`/presentations/${deck.id}`);
}

async function lastPosition(supabase: Supabase, presentationId: string) {
  const { data } = await supabase
    .from("presentation_slides")
    .select("position")
    .eq("presentation_id", presentationId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>();
  return data?.position ?? -1;
}

/** Appends slides before the closing slide, if the deck still ends with one. */
export async function addSlides(presentationId: string, items: DeckItem[] | "blank"): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const rows: SlideRow[] =
      items === "blank"
        ? [{ kind: "blank", hamper_id: null, product_id: null, canvas: blankSlide() }]
        : await itemSlides(supabase, z.array(ItemSchema).parse(items));
    if (!rows.length) return { error: "Nothing to add." };

    const { data: ordered } = await supabase
      .from("presentation_slides")
      .select("id, kind, position")
      .eq("presentation_id", presentationId)
      .order("position")
      .returns<{ id: string; kind: string; position: number }[]>();
    const slides = ordered ?? [];
    const closing = slides.at(-1)?.kind === "closing" ? slides.at(-1)! : null;
    const start = closing ? closing.position : (await lastPosition(supabase, presentationId)) + 1;

    const { error } = await supabase
      .from("presentation_slides")
      .insert(rows.map((s, i) => ({ ...s, presentation_id: presentationId, position: start + i })));
    if (error) return { error: describeError(error) };
    if (closing) {
      await supabase.from("presentation_slides").update({ position: start + rows.length }).eq("id", closing.id);
    }
    await touch(supabase, presentationId);
    revalidatePath(`/presentations/${presentationId}`);
    return { ok: true };
  } catch (err) {
    return { error: describeError(err) };
  }
}

async function touch(supabase: Supabase, presentationId: string) {
  // The trigger sets updated_at; any update fires it.
  await supabase.from("presentations").update({ updated_at: new Date().toISOString() }).eq("id", presentationId);
}

export async function moveSlide(presentationId: string, slideId: string, by: -1 | 1): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("presentation_slides")
    .select("id, position")
    .eq("presentation_id", presentationId)
    .order("position")
    .returns<{ id: string; position: number }[]>();
  const ids = (data ?? []).map((s) => s.id);
  const from = ids.indexOf(slideId);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return { ok: true };
  [ids[from], ids[to]] = [ids[to], ids[from]];

  // Renumber 0..n so positions stay tidy after deletes.
  const results = await Promise.all(
    ids.map((id, position) =>
      (data ?? []).find((s) => s.id === id)?.position === position
        ? null
        : supabase.from("presentation_slides").update({ position }).eq("id", id),
    ),
  );
  const failed = results.find((r) => r?.error);
  if (failed?.error) return { error: describeError(failed.error) };
  revalidatePath(`/presentations/${presentationId}`);
  return { ok: true };
}

export async function deleteSlide(presentationId: string, slideId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("presentation_slides").delete().eq("id", slideId).eq("presentation_id", presentationId);
  if (error) return { error: describeError(error) };
  await touch(supabase, presentationId);
  revalidatePath(`/presentations/${presentationId}`);
  return { ok: true };
}

export async function renamePresentation(presentationId: string, title: string): Promise<ActionResult> {
  const clean = title.trim();
  if (!clean) return { error: "The title can't be empty." };
  const supabase = await createClient();
  const { error } = await supabase.from("presentations").update({ title: clean }).eq("id", presentationId);
  if (error) return { error: describeError(error) };
  revalidatePath("/presentations");
  revalidatePath(`/presentations/${presentationId}`);
  return { ok: true };
}

export async function deletePresentation(presentationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("presentations").delete().eq("id", presentationId);
  if (error) return { error: describeError(error) };

  // Best effort: uploaded backgrounds for this deck.
  const folder = `presentations/${presentationId}`;
  const { data: files } = await supabase.storage.from(BUCKET).list(folder);
  if (files?.length) await supabase.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`));

  revalidatePath("/presentations");
  redirect("/presentations");
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
    revalidatePath(`/presentations/${presentationId}`, "layout");
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
    const path = `presentations/${presentationId}/asset-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) return { error: `Storage upload failed: ${describeError(error)}` };
    return { ok: true, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
  } catch (err) {
    return { error: describeError(err) };
  }
}
