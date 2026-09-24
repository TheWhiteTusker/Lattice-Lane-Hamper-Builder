"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { describeError } from "@/lib/forms";
import { colorTag } from "@/lib/product-code";
import type { ProductImage } from "@/lib/types";
import type { ImageActionResult } from "./image-types";

/**
 * Upload an image file for a product to the product-images Supabase storage bucket
 */
export async function uploadProductImage(formData: FormData): Promise<ImageActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "You must be signed in to upload images." };

    const file = formData.get("file") as File | null;
    const productId = formData.get("productId")?.toString()?.trim();
    const rawColor = formData.get("color")?.toString()?.trim() || null;
    const isPrimary = formData.get("isPrimary") === "true";
    const caption = formData.get("caption")?.toString()?.trim() || null;

    if (!file || !(file instanceof File) || file.size === 0) {
      return { error: "Please select an image file to upload." };
    }
    if (!productId) {
      return { error: "Product ID is missing." };
    }

    // Generate safe storage path
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const storagePath = `products/${productId}/${safeName}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(storagePath, buffer, {
        contentType: file.type || `image/${ext}`,
        upsert: false,
      });

    if (uploadError) {
      return { error: `Storage upload failed: ${describeError(uploadError)}` };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("product-images").getPublicUrl(storagePath);

    // If marked primary, clear existing primary flags
    if (isPrimary) {
      await supabase
        .from("product_images")
        .update({ is_primary: false })
        .eq("product_id", productId);
    } else {
      // Check if this is the first image for the product
      const { count } = await supabase
        .from("product_images")
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId)
        .is("deleted_at", null);
      if (count === 0) {
        // Automatically make first image primary
        await supabase
          .from("products")
          .update({ image_url: publicUrl })
          .eq("id", productId);
      }
    }

    // Insert record in product_images
    const { data: inserted, error: dbError } = await supabase
      .from("product_images")
      .insert({
        product_id: productId,
        url: publicUrl,
        storage_path: storagePath,
        ...colorTag(rawColor),
        is_primary: isPrimary,
        caption,
      })
      .select("*")
      .single<ProductImage>();

    if (dbError) {
      return { error: `Database save failed: ${describeError(dbError)}` };
    }

    if (isPrimary) {
      await supabase
        .from("products")
        .update({ image_url: publicUrl })
        .eq("id", productId);
    }

    revalidatePath("/products");
    revalidatePath("/hampers");
    revalidatePath("/cost-calculator", "layout");

    return { ok: true, image: inserted };
  } catch (err: unknown) {
    return { error: describeError(err) };
  }
}

/**
 * Add an external image URL for a product
 */
export async function addExternalProductImage(
  productId: string,
  url: string,
  color?: string | null,
  isPrimary: boolean = false,
  caption?: string | null,
): Promise<ImageActionResult> {
  try {
    const supabase = await createClient();
    const cleanUrl = url.trim();
    if (!cleanUrl) return { error: "Image URL is required." };
    if (!productId) return { error: "Product ID is missing." };

    if (isPrimary) {
      await supabase
        .from("product_images")
        .update({ is_primary: false })
        .eq("product_id", productId);
    }

    const { data: inserted, error: dbError } = await supabase
      .from("product_images")
      .insert({
        product_id: productId,
        url: cleanUrl,
        storage_path: null,
        ...colorTag(color),
        is_primary: isPrimary,
        caption: caption || null,
      })
      .select("*")
      .single<ProductImage>();

    if (dbError) return { error: describeError(dbError) };

    if (isPrimary) {
      await supabase
        .from("products")
        .update({ image_url: cleanUrl })
        .eq("id", productId);
    }

    revalidatePath("/products");
    revalidatePath("/hampers");
    return { ok: true, image: inserted };
  } catch (err: unknown) {
    return { error: describeError(err) };
  }
}
