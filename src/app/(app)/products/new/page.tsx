import { requireRole } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";
import type { Category } from "@/lib/types";

export default async function NewProductPage() {
  const { supabase } = await requireRole("admin");

  const [{ data: categories }, settings] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order").order("name").returns<Category[]>(),
    loadSettings(supabase),
  ]);

  return (
    <>
      <PageHeader title="New product" subtitle="Adds a line to the Product Master" />
      <ProductForm categories={categories ?? []} sources={settings.sources} />
    </>
  );
}
