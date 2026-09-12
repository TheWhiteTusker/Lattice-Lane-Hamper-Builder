import type { ProductImage } from "./types.ts";
import { COLOR_TO_CODE, CODE_TO_COLOR } from "./product-code.ts";

/**
 * Filter images for a specific color finish (e.g. "Walnut", "Natural", "Black" or "WL", "NT", "BL").
 * If includeGeneral is true (default), images with null/empty color are also included as fallback.
 */
export function getImagesForColor(
  images: ProductImage[] = [],
  colorOrCode?: string | null,
  includeGeneral: boolean = true,
): ProductImage[] {
  if (!images || images.length === 0) return [];
  if (!colorOrCode) return images;

  const key = colorOrCode.trim().toLowerCase();
  const normalizedCode = COLOR_TO_CODE[key] || (colorOrCode.toUpperCase() as "WL" | "NT" | "BL");
  const normalizedName = (CODE_TO_COLOR as Record<string, string>)[normalizedCode] || colorOrCode;

  const filtered = images.filter((img) => {
    if (!img.color && !img.color_code) return includeGeneral;
    const imgCode = img.color_code?.toUpperCase() || (img.color ? COLOR_TO_CODE[img.color.toLowerCase()] : "");
    const imgName = img.color || (img.color_code ? (CODE_TO_COLOR as Record<string, string>)[img.color_code] : "");

    return (
      (normalizedCode && imgCode === normalizedCode) ||
      (imgName && imgName.toLowerCase() === normalizedName.toLowerCase())
    );
  });

  return filtered.length > 0 ? filtered : includeGeneral ? images : [];
}

/**
 * Get the best primary image URL for a product, prioritizing a requested color variant.
 */
export function getPrimaryImage(
  images: ProductImage[] = [],
  preferredColorOrCode?: string | null,
): ProductImage | null {
  if (!images || images.length === 0) return null;

  if (preferredColorOrCode) {
    const colorImages = getImagesForColor(images, preferredColorOrCode, false);
    if (colorImages.length > 0) {
      const primaryInColor = colorImages.find((img) => img.is_primary);
      if (primaryInColor) return primaryInColor;
      return colorImages[0];
    }
  }

  // Fallback to overall primary image
  const globalPrimary = images.find((img) => img.is_primary);
  if (globalPrimary) return globalPrimary;

  // Fallback to first image
  return images[0];
}

/**
 * Group images by color finish: "Walnut", "Natural", "Black", and "General"
 */
export function groupImagesByColor(
  images: ProductImage[] = [],
): Record<string, ProductImage[]> {
  const groups: Record<string, ProductImage[]> = {
    Walnut: [],
    Natural: [],
    Black: [],
    General: [],
  };

  for (const img of images) {
    const rawColor = (img.color || "").trim().toLowerCase();
    const code = img.color_code?.toUpperCase() || COLOR_TO_CODE[rawColor];

    if (code === "WL" || rawColor === "walnut") {
      groups.Walnut.push(img);
    } else if (code === "NT" || rawColor === "natural") {
      groups.Natural.push(img);
    } else if (code === "BL" || rawColor === "black") {
      groups.Black.push(img);
    } else {
      groups.General.push(img);
    }
  }

  return groups;
}
