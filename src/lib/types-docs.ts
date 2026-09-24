/** Hampers, quotes, clients and app settings. Re-exported from types.ts. */

import type { DocType } from "./types.ts";

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
  /** Designer layout, see src/lib/hamper-canvas.ts. */
  canvas: unknown | null;
  image_url: string | null;
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
  image_url: string | null;
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
  /** Registered entity printed on proforma invoices, e.g. "Palm Length LLP". */
  legal_name: string;
  address: string;
  gstin: string;
  phone: string;
  email: string;
  website: string;
  bank_account_name: string;
  bank_name: string;
  bank_account_no: string;
  bank_ifsc: string;
};

export type Client = {
  id: string;
  name: string;
  gstin: string | null;
  billing_address: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
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
  pi_terms: string;
  product_colors: string[];
  /** Swatch colour per product colour name, picked in the Rates & Hierarchy Master. */
  color_hex: Record<string, string>;
};
