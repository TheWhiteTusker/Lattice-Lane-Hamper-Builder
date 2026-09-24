import type { ProductImage } from "@/lib/types";

export type ImageActionResult = {
  ok?: boolean;
  error?: string;
  image?: ProductImage;
};
