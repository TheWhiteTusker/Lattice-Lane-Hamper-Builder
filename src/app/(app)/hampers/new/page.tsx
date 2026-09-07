import { requireRole } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { HamperBuilder } from "../hamper-builder";
import { loadCatalog } from "../data";

export default async function NewHamperPage() {
  const { supabase } = await requireRole("admin", "manager");
  const { products, categories, settings } = await loadCatalog(supabase);

  return (
    <>
      <PageHeader
        title="New hamper"
        subtitle="The code is assigned when you save, continuing from the last one"
      />
      <HamperBuilder
        products={products}
        categories={categories}
        settings={settings}
        canEdit
      />
    </>
  );
}
