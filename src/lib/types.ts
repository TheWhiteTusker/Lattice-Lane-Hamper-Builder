/**
 * Row shapes for the tables and views in supabase/migrations.
 *
 * Hand-written rather than generated, because generating requires a live
 * project. Once the project exists you can replace this file with:
 *   npx supabase gen types typescript --project-id <id> > src/lib/types.ts
 */

export type UserRole = "admin" | "manager" | "sales";
export type DocType = "quotation" | "proforma_invoice";

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  code?: string | null;
  counts_as_item: boolean;
  sort_order: number;
  is_active: boolean;
};

export type ProductImage = {
  id: string;
  product_id: string;
  url: string;
  storage_path?: string | null;
  color?: string | null; // e.g. "Walnut", "Natural", "Black" or null for General/All
  color_code?: string | null; // e.g. "WL", "NT", "BL"
  is_primary: boolean;
  sort_order: number;
  caption?: string | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  code: string;
  category_id: string | null;
  name: string;
  source: string | null;
  cost_price: number;
  markup_pct?: number;
  target_margin: number;
  default_sp: number;
  colors?: string[];
  image_url?: string | null;
  images?: ProductImage[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Product joined to its category, the shape the builder needs. */
export type ProductWithCategory = Product & {
  categories: { name: string; counts_as_item: boolean } | null;
};

export type CostStage = {
  id: string;
  code: string;
  name: string;
  calculation_type: "dimension" | "piece" | "time_based";
  sort_order: number;
  is_active: boolean;
};

export type CostCategory = {
  id: string;
  stage_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type CostSubcategory = {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type CostVariety = {
  id: string;
  subcategory_id: string;
  name: string; // e.g. '8mm', '12mm', '10x2mm'
  default_rate: number;
  unit: string;
  default_wastage_pct: number;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
};

export type CostSubcategoryWithVarieties = CostSubcategory & {
  varieties: CostVariety[];
};

export type CostCategoryWithSubcategories = CostCategory & {
  subcategories: CostSubcategoryWithVarieties[];
};

export type CostStageWithHierarchy = CostStage & {
  categories: CostCategoryWithSubcategories[];
};

export type ProductCostLine = {
  id?: string;
  sheet_id?: string;
  stage_code: string; // 'material' | 'hardware' | 'finishing' | 'machine'
  category_name: string; // e.g. 'Woodbased'
  subcategory_name?: string | null; // e.g. 'Birch'
  variety_name?: string | null; // e.g. '8mm'
  item_name: string; // legacy or combined display
  cost_item_id?: string | null;
  cost_variety_id?: string | null;
  length?: number | null;
  breadth?: number | null;
  dimension_unit?: string; // 'inch' | 'mm' | 'cm'
  unit: string;
  rate: number;
  duration_minutes?: number | null;
  qty: number;
  wastage_pct: number;
  calculated_area?: number | null;
  line_total: number;
  sort_order?: number;
};

export type ProductCostSheet = {
  id: string;
  product_id: string | null;
  product_code: string | null;
  product_name: string;
  material_total: number;
  hardware_total: number;
  finishing_total: number;
  machine_total: number;
  total_cost: number;
  markup_pct: number;
  calculated_sp: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  lines?: ProductCostLine[];
};

export type Hamper = {
  id: string;
  code: string;
  name: string;
  collection: string | null;
  status: string;
  target_sp: number | null;
  notes: string | null;
  discount_pct: number;
  final_catalogue_sp: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type HamperItem = {
  id: string;
  hamper_id: string;
  line_no: number;
  product_id: string | null;
  product_code: string | null;
  product_name: string;
  category_name: string | null;
  source: string | null;
  qty: number;
  unit_cp: number;
  unit_sp: number;
  target_margin: number;
  total_cp: number;
  total_sp: number;
};

/** The `hamper_summary` view - what the Hamper Summary sheet used to hold. */
export type HamperSummary = {
  id: string;
  code: string;
  name: string;
  collection: string | null;
  status: string;
  number_of_items: number;
  total_cp: number;
  base_sp: number;
  discount_pct: number;
  sp_after_discount: number;
  target_sp: number | null;
  variance: number | null;
  final_catalogue_sp: number | null;
  gross_profit: number | null;
  final_margin: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  line_count: number;
};

export type Quote = {
  id: string;
  doc_no: string;
  doc_type: DocType;
  doc_date: string;
  client_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  billing_address: string | null;
  gstin: string | null;
  occasion: string | null;
  quote_structure: string;
  validity: string | null;
  status: string;
  order_discount: number;
  adj1: number;
  adj2: number;
  gst_rate: number;
  notes: string | null;
  terms: string | null;
  follow_up_date: string | null;
  linked_doc_no: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  line_no: number;
  option_label: string | null;
  hamper_id: string | null;
  hamper_code: string | null;
  hamper_name: string | null;
  qty: number;
  catalogue_price: number;
  discount_pct: number;
  detail_mode: string | null;
  packaging_treatment: string | null;
  final_rate: number;
  amount: number;
};

/** The `quote_summary` view. */
export type QuoteSummary = Quote & {
  subtotal: number;
  total_qty: number;
  line_count: number;
  taxable_value: number | null;
  gst_amount: number | null;
  grand_total: number | null;
};

export type CompanySettings = {
  name: string;
  address: string;
  gstin: string;
  phone: string;
  email: string;
  website: string;
};

/** Everything in app_settings, resolved into one object. */
export type Settings = {
  company: CompanySettings;
  gst_rate: number;
  doc_prefixes: { hamper: string; quotation: string; proforma_invoice: string };
  hamper_statuses: string[];
  quote_statuses: string[];
  quote_structures: string[];
  validity_options: string[];
  collections: string[];
  sources: string[];
  detail_modes: string[];
  default_detail_mode: string;
  packaging_treatments: string[];
  default_packaging_treatment: string;
  default_validity: string;
  quote_terms: string;
  product_colors: string[];
};
