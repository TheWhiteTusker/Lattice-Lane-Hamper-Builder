import { parseProductCode } from "./product-code.ts";

type ProductVariant = {
  id: string;
  code: string;
  colors?: string[] | null;
};

/** Product id for each colour in a family of sibling product variants. */
export function variantIdsByColor(products: ProductVariant[]): Record<string, string> {
  const ids: Record<string, string> = {};

  for (const product of products) {
    const colors = (product.colors ?? []).filter(Boolean);
    if (colors.length > 0) {
      for (const color of colors) ids[color] = product.id;
      continue;
    }

    // Legacy variants may have no colors array, but their code still carries
    // the finish (for example LC/0001/NT).
    const parsed = parseProductCode(product.code);
    if (parsed.colorName) ids[parsed.colorName] = product.id;
  }

  return ids;
}
