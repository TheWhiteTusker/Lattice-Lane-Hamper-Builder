export type PickListKey =
  | "hamper_statuses"
  | "quote_statuses"
  | "quote_structures"
  | "collections"
  | "sources"
  | "validity_options"
  | "detail_modes"
  | "packaging_treatments"
  | "product_colors";

export type PickListConfig = {
  key: PickListKey;
  label: string;
  hint?: string;
};

export const PICK_LIST_CONFIGS: PickListConfig[] = [
  {
    key: "hamper_statuses",
    label: "Hamper statuses",
    hint: "Statuses used in the hamper builder (e.g. Draft, Approved, Active, Discontinued).",
  },
  {
    key: "quote_statuses",
    label: "Quotation statuses",
    hint: "Only managers can move a quotation between these statuses.",
  },
  {
    key: "quote_structures",
    label: "Quote structures",
    hint: 'Only "Combined Order" produces an order total.',
  },
  {
    key: "collections",
    label: "Collections / occasions",
    hint: "Occasions and collections for categorising hampers (e.g. Festive, Corporate, Wedding).",
  },
  {
    key: "sources",
    label: "Sources / vendors",
    hint: "Vendor types and sources for products (e.g. In-house, Outsourced, Hybrid).",
  },
  {
    key: "validity_options",
    label: "Validity options",
    hint: "Validity durations offered when creating a quotation (e.g. 7 Days, 15 Days).",
  },
  {
    key: "detail_modes",
    label: "Contents shown on a quotation",
    hint: 'Anything containing "hide" hides contents, "summary" prints a count.',
  },
  {
    key: "packaging_treatments",
    label: "Packaging treatments",
    hint: 'Anything containing "absorb" folds packaging cost into the hamper.',
  },
  {
    key: "product_colors",
    label: "Product colors / finishes",
    hint: "Standard color variants available for catalog products.",
  },
];
