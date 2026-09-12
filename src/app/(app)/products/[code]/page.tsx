import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";
import type { Category, Product } from "@/lib/types";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { supabase } = await requireRole("admin");

  const [{ data: product }, { data: categories }, settings] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("code", decodeURIComponent(code))
      .maybeSingle<Product>(),
    supabase.from("categories").select("*").order("sort_order").order("name").returns<Category[]>(),
    loadSettings(supabase),
  ]);

  if (!product) notFound();

  return (
    <>
      <PageHeader title={product.name} subtitle={product.code}>
        <Link
          href={`/cost-calculator?product=${encodeURIComponent(product.code)}`}
          className="btn-secondary"
        >
          Cost Calculator
        </Link>
      </PageHeader>
      <ProductForm
        product={product}
        categories={categories ?? []}
        sources={settings.sources}
        allColors={settings.product_colors}
      />
    </>
  );
}
