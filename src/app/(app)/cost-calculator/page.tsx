import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { loadSettings } from "@/lib/settings";
import { CostCalculatorView } from "./calculator-view";
import { CostMasterView } from "./master-view";
import type {
  Category,
  CostCategory,
  CostSubcategory,
  CostVariety,
  CostStage,
  CostStageWithHierarchy,
  Product,
  ProductCostLine,
  ProductCostSheet,
  ProductImage,
} from "@/lib/types";

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CostCalculatorPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const params = await searchParams;
  const productQuery = one(params.product).trim();
  const activeTab = one(params.tab) === "master" ? "master" : "calculator";

  const { supabase } = await requireUser();

  // Load stages, categories, subcategories, varieties, products, and settings in parallel
  const [
    { data: stagesData },
    { data: categoriesData },
    { data: subcategoriesData },
    { data: varietiesData },
    { data: productsData },
    { data: productCats },
    settings,
  ] = await Promise.all([
    supabase
      .from("cost_stages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .returns<CostStage[]>(),
    supabase
      .from("cost_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .returns<CostCategory[]>(),
    supabase
      .from("cost_subcategories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .returns<CostSubcategory[]>(),
    supabase
      .from("cost_varieties")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .returns<CostVariety[]>(),
    supabase
      .from("products")
      .select("*")
      .order("code")
      .returns<Product[]>(),
    supabase
      .from("categories")
      .select("*")
      .order("sort_order")
      .returns<Category[]>(),
    loadSettings(supabase),
  ]);

  // Nest 4-level hierarchy: stage -> category -> subcategory -> variety
  const varietiesBySub = new Map<string, CostVariety[]>();
  for (const v of varietiesData ?? []) {
    const list = varietiesBySub.get(v.subcategory_id) ?? [];
    list.push(v);
    varietiesBySub.set(v.subcategory_id, list);
  }

  const subsByCat = new Map<
    string,
    Array<CostSubcategory & { varieties: CostVariety[] }>
  >();
  for (const sub of subcategoriesData ?? []) {
    const list = subsByCat.get(sub.category_id) ?? [];
    list.push({
      ...sub,
      varieties: varietiesBySub.get(sub.id) ?? [],
    });
    subsByCat.set(sub.category_id, list);
  }

  const catsByStage = new Map<
    string,
    Array<
      CostCategory & {
        subcategories: Array<CostSubcategory & { varieties: CostVariety[] }>;
      }
    >
  >();
  for (const cat of categoriesData ?? []) {
    const list = catsByStage.get(cat.stage_id) ?? [];
    list.push({
      ...cat,
      subcategories: subsByCat.get(cat.id) ?? [],
    });
    catsByStage.set(cat.stage_id, list);
  }

  const nestedStages: CostStageWithHierarchy[] = (stagesData ?? []).map((stage) => ({
    ...stage,
    categories: catsByStage.get(stage.id) ?? [],
  }));

  // If a product is requested, load the product and its cost sheet + lines
  let initialProduct: Product | null = null;
  let initialSheet: (ProductCostSheet & { lines: ProductCostLine[] }) | null = null;
  let initialImages: ProductImage[] = [];

  if (productQuery) {
    const { data: prod } = await supabase
      .from("products")
      .select("*")
      .eq("code", productQuery)
      .maybeSingle<Product>();

    if (prod) {
      initialProduct = prod;
      const [{ data: sheet }, { data: imgData }] = await Promise.all([
        supabase
          .from("product_cost_sheets")
          .select("*")
          .eq("product_id", prod.id)
          .maybeSingle<ProductCostSheet>(),
        supabase
          .from("product_images")
          .select("*")
          .eq("product_id", prod.id)
          .order("sort_order")
          .order("created_at")
          .returns<ProductImage[]>(),
      ]);

      initialImages = imgData ?? [];

      if (sheet) {
        const { data: lines } = await supabase
          .from("product_cost_lines")
          .select("*")
          .eq("sheet_id", sheet.id)
          .order("sort_order")
          .returns<ProductCostLine[]>();

        initialSheet = {
          ...sheet,
          lines: lines ?? [],
        };
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Product Cost Calculator"
        subtitle="Stage-by-stage costing engine: Material, Hardware, Finishing & Machine per-minute costs"
      >
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <Link
            href={
              productQuery
                ? `/cost-calculator?product=${encodeURIComponent(productQuery)}`
                : "/cost-calculator"
            }
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "calculator"
                ? "bg-white text-[var(--color-brand-dark)] shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            Cost Calculator
          </Link>
          <Link
            href="/cost-calculator?tab=master"
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "master"
                ? "bg-white text-[var(--color-brand-dark)] shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            Rates & Hierarchy Master
          </Link>
        </div>
      </PageHeader>

      {activeTab === "calculator" ? (
        <CostCalculatorView
          stages={nestedStages}
          categories={productCats ?? []}
          products={productsData ?? []}
          productColors={settings.product_colors ?? ["Walnut", "Natural", "Teak"]}
          initialProduct={initialProduct}
          initialSheet={initialSheet}
          initialImages={initialImages}
        />
      ) : (
        <CostMasterView
          stages={nestedStages}
          productColors={settings.product_colors ?? ["Walnut", "Natural", "Teak"]}
        />
      )}
    </>
  );
}
