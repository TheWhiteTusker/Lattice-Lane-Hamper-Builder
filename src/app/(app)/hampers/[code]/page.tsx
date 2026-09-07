import { notFound } from "next/navigation";
import { requireUser, canManage } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { HamperBuilder } from "../hamper-builder";
import { loadCatalog } from "../data";
import type { Hamper, HamperItem } from "@/lib/types";

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function HamperPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Search;
}) {
  const { code } = await params;
  const flags = await searchParams;

  const { supabase, profile } = await requireUser();

  const { data: hamper } = await supabase
    .from("hampers")
    .select("*")
    .eq("code", decodeURIComponent(code))
    .maybeSingle<Hamper>();

  if (!hamper) notFound();

  const [{ data: items }, catalog] = await Promise.all([
    supabase
      .from("hamper_items")
      .select("*")
      .eq("hamper_id", hamper.id)
      .order("line_no")
      .returns<HamperItem[]>(),
    loadCatalog(supabase),
  ]);

  const duplicatedFrom = flags.duplicated;

  return (
    <>
      <PageHeader title={hamper.name} subtitle={hamper.code}>
        <span className="badge">{hamper.status}</span>
      </PageHeader>

      {duplicatedFrom && (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          Copied from {duplicatedFrom}. Adjust it and save.
        </p>
      )}

      <HamperBuilder
        hamper={hamper}
        items={items ?? []}
        products={catalog.products}
        categories={catalog.categories}
        settings={catalog.settings}
        canEdit={canManage(profile.role)}
      />
    </>
  );
}
