/** Where a product's costing lives: /cost-calculator/LC%2F0001%2FWL, like /products/[...code]. */
export const costingHref = (code: string) => `/cost-calculator/${encodeURIComponent(code)}`;
