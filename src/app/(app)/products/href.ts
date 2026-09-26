/**
 * Dynamic route helper for products: /products/LC/0001/WL via catch-all [...code].
 * Encodes each path segment so slashes remain clean route separators.
 */
export const productHref = (code: string): string =>
  `/products/${code.split("/").map(encodeURIComponent).join("/")}`;
