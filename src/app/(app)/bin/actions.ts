"use server";

import { revalidatePath } from "next/cache";
import { requireUser, canManage, isAdmin } from "@/lib/supabase/server";
import { describeError } from "@/lib/forms";
import type { BinItemType } from "./bin-types";

const BUCKET = "product-images";

export type BinActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

/**
 * Restores a soft-deleted item from the Bin back into active use.
 */
export async function restoreBinItem(
  id: string,
  type: BinItemType,
): Promise<BinActionResult> {
  try {
    const { supabase, profile } = await requireUser();

    if (type === "hamper") {
      if (!canManage(profile.role)) {
        return { error: "You don't have permission to restore hampers." };
      }

      const { data: hamper, error: fetchErr } = await supabase
        .from("hampers")
        .select("id, code, name")
        .eq("id", id)
        .not("deleted_at", "is", null)
        .maybeSingle<{ id: string; code: string; name: string }>();

      if (fetchErr || !hamper) {
        return { error: "Hamper not found in Bin." };
      }

      // Check if an active hamper already has this code
      const { data: conflict } = await supabase
        .from("hampers")
        .select("id")
        .eq("code", hamper.code)
        .is("deleted_at", null)
        .maybeSingle();

      if (conflict) {
        return {
          error: `Cannot restore: an active hamper with code "${hamper.code}" already exists. Please rename or delete it first.`,
        };
      }

      const { error: updateErr } = await supabase
        .from("hampers")
        .update({ deleted_at: null })
        .eq("id", id);

      if (updateErr) return { error: describeError(updateErr) };

      revalidatePath("/hampers");
      revalidatePath("/bin");
      revalidatePath("/dashboard");
      return { ok: true, message: `Hamper "${hamper.name}" (${hamper.code}) restored.` };
    }

    if (type === "product") {
      if (!isAdmin(profile.role)) {
        return { error: "Only administrators can restore products." };
      }

      const { data: product, error: fetchErr } = await supabase
        .from("products")
        .select("id, code, name")
        .eq("id", id)
        .not("deleted_at", "is", null)
        .maybeSingle<{ id: string; code: string; name: string }>();

      if (fetchErr || !product) {
        return { error: "Product not found in Bin." };
      }

      // Check if an active product already has this code
      const { data: conflict } = await supabase
        .from("products")
        .select("id")
        .eq("code", product.code)
        .is("deleted_at", null)
        .maybeSingle();

      if (conflict) {
        return {
          error: `Cannot restore: an active product with code "${product.code}" already exists.`,
        };
      }

      const { error: updateErr } = await supabase
        .from("products")
        .update({ deleted_at: null })
        .eq("id", id);

      if (updateErr) return { error: describeError(updateErr) };

      revalidatePath("/products");
      revalidatePath("/bin");
      revalidatePath("/cost-calculator", "layout");
      return { ok: true, message: `Product "${product.name}" (${product.code}) restored.` };
    }

    if (type === "image") {
      if (!canManage(profile.role)) {
        return { error: "You don't have permission to restore photos." };
      }

      const { data: image, error: fetchErr } = await supabase
        .from("product_images")
        .select("id, product_id, url")
        .eq("id", id)
        .not("deleted_at", "is", null)
        .maybeSingle<{ id: string; product_id: string; url: string }>();

      if (fetchErr || !image) {
        return { error: "Photo not found in Bin." };
      }

      const { error: updateErr } = await supabase
        .from("product_images")
        .update({ deleted_at: null })
        .eq("id", id);

      if (updateErr) return { error: describeError(updateErr) };

      // If parent product currently has no image, set this as primary
      const { data: prod } = await supabase
        .from("products")
        .select("image_url")
        .eq("id", image.product_id)
        .maybeSingle<{ image_url: string | null }>();

      if (prod && !prod.image_url) {
        await supabase
          .from("products")
          .update({ image_url: image.url })
          .eq("id", image.product_id);
        await supabase
          .from("product_images")
          .update({ is_primary: true })
          .eq("id", id);
      }

      revalidatePath("/products");
      revalidatePath("/hampers");
      revalidatePath("/bin");
      return { ok: true, message: "Product photo restored." };
    }

    return { error: "Unknown item type." };
  } catch (err: unknown) {
    return { error: describeError(err) };
  }
}

/**
 * Permanently deletes a single item from the database and removes any associated storage files.
 */
export async function permanentlyDeleteBinItem(
  id: string,
  type: BinItemType,
): Promise<BinActionResult> {
  try {
    const { supabase, profile } = await requireUser();

    if (type === "hamper") {
      if (!canManage(profile.role)) {
        return { error: "You don't have permission to permanently delete hampers." };
      }

      // Clean storage files under hampers/{id}/
      const { data: files } = await supabase.storage
        .from(BUCKET)
        .list(`hampers/${id}`);

      if (files?.length) {
        await supabase.storage
          .from(BUCKET)
          .remove(files.map((f) => `hampers/${id}/${f.name}`));
      }

      const { error: delErr } = await supabase
        .from("hampers")
        .delete()
        .eq("id", id);

      if (delErr) return { error: describeError(delErr) };

      revalidatePath("/hampers");
      revalidatePath("/bin");
      return { ok: true, message: "Hamper permanently deleted." };
    }

    if (type === "product") {
      if (!isAdmin(profile.role)) {
        return { error: "Only administrators can permanently delete products." };
      }

      // Find all product images to remove storage files
      const { data: images } = await supabase
        .from("product_images")
        .select("storage_path")
        .eq("product_id", id);

      const paths = (images ?? [])
        .map((img) => img.storage_path)
        .filter((p): p is string => Boolean(p));

      if (paths.length) {
        await supabase.storage.from(BUCKET).remove(paths);
      }

      // Also list any files under products/{id}/
      const { data: files } = await supabase.storage
        .from(BUCKET)
        .list(`products/${id}`);

      if (files?.length) {
        await supabase.storage
          .from(BUCKET)
          .remove(files.map((f) => `products/${id}/${f.name}`));
      }

      // Hard delete product images first
      await supabase.from("product_images").delete().eq("product_id", id);

      const { error: delErr } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (delErr) return { error: describeError(delErr) };

      revalidatePath("/products");
      revalidatePath("/bin");
      return { ok: true, message: "Product permanently deleted." };
    }

    if (type === "image") {
      if (!canManage(profile.role)) {
        return { error: "You don't have permission to delete photos." };
      }

      const { data: img } = await supabase
        .from("product_images")
        .select("storage_path")
        .eq("id", id)
        .maybeSingle<{ storage_path: string | null }>();

      if (img?.storage_path) {
        await supabase.storage.from(BUCKET).remove([img.storage_path]);
      }

      const { error: delErr } = await supabase
        .from("product_images")
        .delete()
        .eq("id", id);

      if (delErr) return { error: describeError(delErr) };

      revalidatePath("/products");
      revalidatePath("/bin");
      return { ok: true, message: "Photo permanently deleted." };
    }

    return { error: "Unknown item type." };
  } catch (err: unknown) {
    return { error: describeError(err) };
  }
}

/**
 * Permanently deletes all items in the Bin, or all items of a specific type.
 */
export async function emptyBinAction(
  scope: "all" | BinItemType = "all",
): Promise<BinActionResult> {
  try {
    const { supabase, profile } = await requireUser();

    let deletedCount = 0;

    // Hampers
    if (scope === "all" || scope === "hamper") {
      if (canManage(profile.role)) {
        const { data: hampers } = await supabase
          .from("hampers")
          .select("id")
          .not("deleted_at", "is", null);

        for (const h of hampers ?? []) {
          const { data: files } = await supabase.storage.from(BUCKET).list(`hampers/${h.id}`);
          if (files?.length) {
            await supabase.storage.from(BUCKET).remove(files.map((f) => `hampers/${h.id}/${f.name}`));
          }
          await supabase.from("hampers").delete().eq("id", h.id);
          deletedCount++;
        }
      }
    }

    // Products
    if (scope === "all" || scope === "product") {
      if (isAdmin(profile.role)) {
        const { data: products } = await supabase
          .from("products")
          .select("id")
          .not("deleted_at", "is", null);

        for (const p of products ?? []) {
          const { data: images } = await supabase
            .from("product_images")
            .select("storage_path")
            .eq("product_id", p.id);

          const paths = (images ?? [])
            .map((img) => img.storage_path)
            .filter((s): s is string => Boolean(s));

          if (paths.length) {
            await supabase.storage.from(BUCKET).remove(paths);
          }

          const { data: files } = await supabase.storage.from(BUCKET).list(`products/${p.id}`);
          if (files?.length) {
            await supabase.storage.from(BUCKET).remove(files.map((f) => `products/${p.id}/${f.name}`));
          }

          await supabase.from("product_images").delete().eq("product_id", p.id);
          await supabase.from("products").delete().eq("id", p.id);
          deletedCount++;
        }
      }
    }

    // Product Images
    if (scope === "all" || scope === "image") {
      if (canManage(profile.role)) {
        const { data: images } = await supabase
          .from("product_images")
          .select("id, storage_path")
          .not("deleted_at", "is", null);

        for (const img of images ?? []) {
          if (img.storage_path) {
            await supabase.storage.from(BUCKET).remove([img.storage_path]);
          }
          await supabase.from("product_images").delete().eq("id", img.id);
          deletedCount++;
        }
      }
    }

    revalidatePath("/hampers");
    revalidatePath("/products");
    revalidatePath("/bin");
    return { ok: true, message: `Successfully deleted ${deletedCount} item${deletedCount === 1 ? "" : "s"} permanently.` };
  } catch (err: unknown) {
    return { error: describeError(err) };
  }
}

/**
 * Purges any items older than 30 days.
 */
export async function purgeExpiredAction(): Promise<BinActionResult> {
  try {
    const { supabase, profile } = await requireUser();
    if (!canManage(profile.role)) {
      return { error: "Permission denied." };
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Purge expired images storage
    const { data: expImages } = await supabase
      .from("product_images")
      .select("id, storage_path")
      .not("deleted_at", "is", null)
      .lte("deleted_at", thirtyDaysAgo);

    for (const img of expImages ?? []) {
      if (img.storage_path) {
        await supabase.storage.from(BUCKET).remove([img.storage_path]);
      }
    }

    // 2. Purge expired hampers storage
    const { data: expHampers } = await supabase
      .from("hampers")
      .select("id")
      .not("deleted_at", "is", null)
      .lte("deleted_at", thirtyDaysAgo);

    for (const h of expHampers ?? []) {
      const { data: files } = await supabase.storage.from(BUCKET).list(`hampers/${h.id}`);
      if (files?.length) {
        await supabase.storage.from(BUCKET).remove(files.map((f) => `hampers/${h.id}/${f.name}`));
      }
    }

    // 3. Purge expired products storage
    const { data: expProducts } = await supabase
      .from("products")
      .select("id")
      .not("deleted_at", "is", null)
      .lte("deleted_at", thirtyDaysAgo);

    for (const p of expProducts ?? []) {
      const { data: files } = await supabase.storage.from(BUCKET).list(`products/${p.id}`);
      if (files?.length) {
        await supabase.storage.from(BUCKET).remove(files.map((f) => `products/${p.id}/${f.name}`));
      }
    }

    // Call database purge function
    await supabase.rpc("purge_expired_bin_records");

    revalidatePath("/hampers");
    revalidatePath("/products");
    revalidatePath("/bin");
    return { ok: true, message: "Expired items have been permanently purged." };
  } catch (err: unknown) {
    return { error: describeError(err) };
  }
}
