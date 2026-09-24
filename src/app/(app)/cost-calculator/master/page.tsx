import { requireUser } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/settings";
import { resolveColors } from "@/lib/product-code";
import { loadCostStages } from "../load";
import { CostMasterView } from "./master-view";

export default async function CostMasterPage() {
  const { supabase } = await requireUser();
  const [stages, settings] = await Promise.all([loadCostStages(supabase), loadSettings(supabase)]);
  return (
    <CostMasterView
      stages={stages}
      productColors={resolveColors(settings.product_colors, settings.color_hex)}
    />
  );
}
