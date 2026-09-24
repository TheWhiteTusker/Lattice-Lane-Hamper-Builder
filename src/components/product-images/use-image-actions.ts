import { useEffect, useState, useTransition } from "react";
import { uploadProductImage, addExternalProductImage } from "@/app/(app)/products/image-actions";
import {
  setPrimaryProductImage,
  updateProductImageColor,
  deleteProductImage,
} from "@/app/(app)/products/image-edit-actions";
import type { ProductImage } from "@/lib/types";

export type Feedback = { error?: string; success?: string };

/** "General" is how the pickers say "no colour". */
const colorOrNull = (color: string) => (color === "General" ? null : color);

/** A product's photos, and the server actions that change them. */
export function useImageActions(
  productId: string,
  initialImages: ProductImage[],
  onImagesChange?: (images: ProductImage[]) => void,
) {
  const [images, setImages] = useState<ProductImage[]>(initialImages);
  useEffect(() => onImagesChange?.(images), [images, onImagesChange]);
  const [feedback, setFeedback] = useState<Feedback>({});
  const [isPending, startTransition] = useTransition();

  // A new primary photo takes the badge from the old one.
  const withAdded = (list: ProductImage[], img: ProductImage) =>
    img.is_primary ? list.map((i) => ({ ...i, is_primary: false })).concat(img) : [...list, img];

  function upload(files: File[], color: string, asPrimary: boolean) {
    if (!files.length) return;
    setFeedback({});
    startTransition(async () => {
      let next = images;
      for (const [i, file] of files.entries()) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("productId", productId);
        formData.append("color", colorOrNull(color) ?? "");
        formData.append("isPrimary", String(asPrimary && i === 0));
        const res = await uploadProductImage(formData);
        if (res.error) {
          setImages(next);
          return setFeedback({ error: res.error });
        }
        if (res.image) next = withAdded(next, res.image);
      }
      setImages(next);
      setFeedback({ success: "Image(s) uploaded successfully!" });
    });
  }

  function addUrl(url: string, color: string, asPrimary: boolean, onAdded: () => void) {
    if (!url.trim()) return;
    setFeedback({});
    startTransition(async () => {
      const res = await addExternalProductImage(productId, url.trim(), colorOrNull(color), asPrimary);
      if (res.error) return setFeedback({ error: res.error });
      if (!res.image) return;
      setImages(withAdded(images, res.image));
      onAdded();
      setFeedback({ success: "Image URL added successfully!" });
    });
  }

  function setPrimary(imageId: string) {
    startTransition(async () => {
      const res = await setPrimaryProductImage(imageId, productId);
      if (res.error) return setFeedback({ error: res.error });
      setImages((prev) => prev.map((img) => ({ ...img, is_primary: img.id === imageId })));
      setFeedback({ success: "Primary cover image updated." });
    });
  }

  function changeColor(imageId: string, newColor: string) {
    startTransition(async () => {
      const res = await updateProductImageColor(imageId, colorOrNull(newColor));
      if (res.error) return setFeedback({ error: res.error });
      if (res.image) setImages((prev) => prev.map((img) => (img.id === imageId ? res.image! : img)));
    });
  }

  function remove(imageId: string) {
    if (!confirm("Are you sure you want to delete this image?")) return;
    startTransition(async () => {
      const res = await deleteProductImage(imageId, productId);
      if (res.error) return setFeedback({ error: res.error });
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      setFeedback({ success: "Image deleted successfully." });
    });
  }

  return { images, feedback, isPending, upload, addUrl, setPrimary, changeColor, remove };
}
