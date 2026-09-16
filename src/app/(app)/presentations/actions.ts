"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { describeError } from "@/lib/forms";
import { CanvasSchema } from "@/lib/hamper-canvas";
import { blankSlide, type DeckItemInfo, type HamperInfo, type Photo, type ProductInfo } from "@/lib/presentation";
import type { ActionResult } from "@/components/studio/editor";
import { getBrandLogo } from "../brand-actions";

const BUCKET = "product-images";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const ItemSchema = z.object({ type: z.enum(["hamper", "product"]), id: z.string().uuid() });
export type DeckItem = z.infer<typeof ItemSchema>;

export type DeckData = {
  hampers: HamperInfo[];
  products: ProductInfo[];
  logo: Photo | null;
  error?: string;
};

/* ------------------------------------------------------------- deck data */

type HamperRow = { id: string; code: string; name: string; final_catalogue_sp: number | null; image_url: string | null };
type LineRow = {
  hamper_id: string;
  product_id: string | null;
  product_name: string;
  category_name: string | null;
  products: { image_url: string | null } | null;
};
type ProductRow = {
  id: string;
  code: string;
  name: string;
  default_sp: number | null;
  image_url: string | null;
  categories: { name: string } | null;
};

/**
 * Everything the browser needs to lay out slides for the picked hampers and
 * products. Packaging that doesn't count as an item (ribbons, fillers) stays
 * off the slides, as in the printed deck.
 */
export async function loadDeckData(items: DeckItem[]): Promise<DeckData> {
  const parsed = z.array(ItemSchema).safeParse(items);
  if (!parsed.success) return { hampers: [], products: [], logo: null, error: "Invalid selection." };
  const supabase = await createClient();
  const hamperIds = parsed.data.filter((i) => i.type === "hamper").map((i) => i.id);
  const productIds = parsed.data.filter((i) => i.type === "product").map((i) => i.id);

  const [hampers, lines, products, categories, logo] = await Promise.all([
    hamperIds.length
      ? supabase
          .from("hamper_summary")
          .select("id, code, name, final_catalogue_sp, image_url")
          .in("id", hamperIds)
          .returns<HamperRow[]>()
          .then((r) => r.data ?? [])
      : Promise.resolve([] as HamperRow[]),
    hamperIds.length
      ? supabase
          .from("hamper_items")
          .select("hamper_id, product_id, product_name, category_name, products(image_url)")
          .in("hamper_id", hamperIds)
          .order("line_no")
          .returns<LineRow[]>()
          .then((r) => r.data ?? [])
      : Promise.resolve([] as LineRow[]),
    productIds.length
      ? supabase
          .from("products")
          .select("id, code, name, default_sp, image_url, categories(name)")
          .in("id", productIds)
          .returns<ProductRow[]>()
          .then((r) => r.data ?? [])
      : Promise.resolve([] as ProductRow[]),
    supabase
      .from("categories")
      .select("name, counts_as_item")
      .returns<{ name: string; counts_as_item: boolean }[]>()
      .then((r) => r.data ?? []),
    getBrandLogo(),
  ]);

  const counts = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.counts_as_item]));
  const countsAsItem = (category: string | null) => counts.get((category ?? "").trim().toLowerCase()) ?? true;

  return {
    logo,
    hampers: hamperIds.flatMap((id): HamperInfo[] => {
      const h = hampers.find((x) => x.id === id);
      if (!h) return [];
      const items: DeckItemInfo[] = lines
        .filter((l) => l.hamper_id === id && countsAsItem(l.category_name))
        .map((l) => ({
          product_id: l.product_id,
          name: l.product_name,
          caption: l.category_name ?? "",
          image_url: l.products?.image_url ?? null,
        }));
      return [
        {
          id: h.id,
          code: h.code,
          name: h.name,
          price: h.final_catalogue_sp == null ? null : Number(h.final_catalogue_sp),
          image_url: h.image_url,
          items,
        },
      ];
    }),
    products: productIds.flatMap((id): ProductInfo[] => {
      const p = products.find((x) => x.id === id);
      if (!p) return [];
      return [
        {
          id: p.id,
          code: p.code,
          name: p.name,
          caption: p.categories?.name ?? "",
          price: p.default_sp == null ? null : Number(p.default_sp),
          image_url: p.image_url,
        },
      ];
    }),
  };
}

/* --------------------------------------------------------------- saving */

const SlideSchema = z.object({
  kind: z.enum(["cover", "hamper", "product", "closing", "blank"]),
  hamper_id: z.string().uuid().nullable(),
  product_id: z.string().uuid().nullable(),
  canvas: CanvasSchema,
});
export type SlideInput = z.input<typeof SlideSchema>;

const CreateSchema = z.object({
  title: z.string().trim().min(1, "Give the presentation a title"),
  slides: z.array(SlideSchema).min(3, "Pick at least one hamper or product"),
});

/** Saves a deck the browser has laid out, then opens it. */
export async function createPresentation(input: { title: string; slides: SlideInput[] }): Promise<ActionResult> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: deck, error } = await supabase
    .from("presentations")
    .insert({ title: parsed.data.title })
    .select("id")
    .single<{ id: string }>();
  if (error || !deck) return { error: describeError(error) };

  const { error: slideError } = await supabase
    .from("presentation_slides")
    .insert(parsed.data.slides.map((s, position) => ({ ...s, presentation_id: deck.id, position })));
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
export async function addSlides(presentationId: string, input: SlideInput[] | "blank"): Promise<ActionResult> {
  try {
    const parsed = z
      .array(SlideSchema)
      .safeParse(input === "blank" ? [{ kind: "blank", hamper_id: null, product_id: null, canvas: blankSlide() }] : input);
    if (!parsed.success) return { error: "Could not read the new slides." };
    const rows = parsed.data;
    if (!rows.length) return { error: "Nothing to add." };

    const supabase = await createClient();
    const { data: ordered } = await supabase
      .from("presentation_slides")
      .select("id, kind, position")
      .eq("presentation_id", presentationId)
      .order("position")
      .returns<{ id: string; kind: string; position: number }[]>();
    const closing = ordered?.at(-1)?.kind === "closing" ? ordered.at(-1)! : null;
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
  const rows = data ?? [];
  const ids = rows.map((s) => s.id);
  const from = ids.indexOf(slideId);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return { ok: true };
  [ids[from], ids[to]] = [ids[to], ids[from]];

  // Renumber 0..n so positions stay tidy after deletes.
  const results = await Promise.all(
    ids.map((id, position) =>
      rows.find((s) => s.id === id)?.position === position
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
