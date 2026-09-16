import { notFound } from "next/navigation";
import { requireRole } from "@/lib/supabase/server";
import { parseCanvas } from "@/lib/hamper-canvas";
import type { Hamper } from "@/lib/types";
import { loadCatalog } from "../../data";
import { CanvasEditor } from "./canvas-editor";

export default async function HamperImagePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { supabase } = await requireRole("admin", "manager");

  const { data: hamper } = await supabase
    .from("hampers")
    .select("*")
    .eq("code", decodeURIComponent(code))
    .maybeSingle<Hamper>();

  if (!hamper) notFound();

  const [{ data: items }, catalog] = await Promise.all([
    supabase
      .from("hamper_items")
      .select("product_id")
      .eq("hamper_id", hamper.id)
      .returns<{ product_id: string | null }[]>(),
    loadCatalog(supabase),
  ]);

  return (
    <CanvasEditor
      hamperId={hamper.id}
      hamperName={hamper.name}
      hamperCode={hamper.code}
      initial={parseCanvas(hamper.canvas)}
      hamperProductIds={[...new Set((items ?? []).flatMap((i) => (i.product_id ? [i.product_id] : [])))]}
      products={catalog.products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        image_url: p.image_url ?? null,
      }))}
    />
  );
}
