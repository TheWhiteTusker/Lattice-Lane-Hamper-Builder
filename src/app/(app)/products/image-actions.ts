"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { describeError } from "@/lib/forms";
import { COLOR_TO_CODE, CODE_TO_COLOR } from "@/lib/product-code";
import type { ProductImage } from "@/lib/types";

export type ImageActionResult = {
  ok?: boolean;
  error?: string;
  image?: ProductImage;
};

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

    // Determine color & code
    const colorCode = rawColor ? COLOR_TO_CODE[rawColor.toLowerCase()] || null : null;
    const colorName = colorCode ? (CODE_TO_COLOR as Record<string, string>)[colorCode] || rawColor : rawColor;

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
        .eq("product_id", productId);
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
        color: colorName,
        color_code: colorCode,
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
    revalidatePath("/cost-calculator");

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

    const colorCode = color ? COLOR_TO_CODE[color.toLowerCase()] || null : null;
    const colorName = colorCode ? (CODE_TO_COLOR as Record<string, string>)[colorCode] || color : color;

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
        color: colorName,
        color_code: colorCode,
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

/**
 * Set an image as the primary cover thumbnail for a product
 */
export async function setPrimaryProductImage(
  imageId: string,
  productId: string,
): Promise<ImageActionResult> {
  try {
    const supabase = await createClient();

    // 1. Clear existing primary
    await supabase
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", productId);

    // 2. Set this image as primary
    const { data: updated, error } = await supabase
      .from("product_images")
      .update({ is_primary: true })
      .eq("id", imageId)
      .select("*")
      .single<ProductImage>();

    if (error) return { error: describeError(error) };

    // 3. Update products.image_url
    if (updated?.url) {
      await supabase
        .from("products")
        .update({ image_url: updated.url })
        .eq("id", productId);
    }

    revalidatePath("/products");
    revalidatePath("/hampers");
    return { ok: true, image: updated };
  } catch (err: unknown) {
    return { error: describeError(err) };
  }
}

/**
 * Update the color finish tag of an image
 */
export async function updateProductImageColor(
  imageId: string,
  rawColor: string | null,
): Promise<ImageActionResult> {
  try {
    const supabase = await createClient();
    const colorCode = rawColor ? COLOR_TO_CODE[rawColor.toLowerCase()] || null : null;
    const colorName = colorCode ? (CODE_TO_COLOR as Record<string, string>)[colorCode] || rawColor : rawColor;

    const { data: updated, error } = await supabase
      .from("product_images")
      .update({
        color: colorName || null,
        color_code: colorCode || null,
      })
      .eq("id", imageId)
      .select("*")
      .single<ProductImage>();

    if (error) return { error: describeError(error) };

    revalidatePath("/products");
    return { ok: true, image: updated };
  } catch (err: unknown) {
    return { error: describeError(err) };
  }
}

/**
 * Delete a product image from database and Supabase storage
 */
export async function deleteProductImage(
  imageId: string,
  productId: string,
): Promise<ImageActionResult> {
  try {
    const supabase = await createClient();

    // Fetch image details
    const { data: img } = await supabase
      .from("product_images")
      .select("*")
      .eq("id", imageId)
      .maybeSingle<ProductImage>();

    if (!img) return { error: "Image not found." };

    // Delete from storage if uploaded to Supabase
    if (img.storage_path) {
      await supabase.storage.from("product-images").remove([img.storage_path]);
    }

    // Delete row
    const { error: delError } = await supabase
      .from("product_images")
      .delete()
      .eq("id", imageId);

    if (delError) return { error: describeError(delError) };

    // If this was primary, update products.image_url to next available or null
    if (img.is_primary) {
      const { data: nextImg } = await supabase
        .from("product_images")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order")
        .order("created_at")
        .limit(1)
        .maybeSingle<ProductImage>();

      if (nextImg) {
        await supabase
          .from("product_images")
          .update({ is_primary: true })
          .eq("id", nextImg.id);
        await supabase
          .from("products")
          .update({ image_url: nextImg.url })
          .eq("id", productId);
      } else {
        await supabase
          .from("products")
          .update({ image_url: null })
          .eq("id", productId);
      }
    }

    revalidatePath("/products");
    revalidatePath("/hampers");
    return { ok: true };
  } catch (err: unknown) {
    return { error: describeError(err) };
  }
}
