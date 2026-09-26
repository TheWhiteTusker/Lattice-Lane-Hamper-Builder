/** Where a product's costing lives: /cost-calculator/LC/0001/WL via dynamic [...code]. */
export const costingHref = (code: string): string =>
  `/cost-calculator/${code.split("/").map(encodeURIComponent).join("/")}`;

