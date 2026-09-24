import type { CostStageWithHierarchy } from "@/lib/types";

/**
 * The hierarchy trimmed to a search. A matching level keeps everything
 * beneath it; otherwise only the children that match are kept.
 */
export function filterStages(stages: CostStageWithHierarchy[], q: string) {
  if (!q) return stages;
  const hit = (s: string | null | undefined) => (s ?? "").toLowerCase().includes(q);
  return stages.flatMap((stage) => {
    if (hit(stage.name)) return [stage];
    const categories = stage.categories.flatMap((cat) => {
      if (hit(cat.name)) return [cat];
      const subcategories = cat.subcategories.flatMap((sub) => {
        if (hit(sub.name)) return [sub];
        const varieties = sub.varieties.filter(
          (v) => hit(v.name) || hit(v.notes) || hit(v.unit),
        );
        return varieties.length ? [{ ...sub, varieties }] : [];
      });
      return subcategories.length ? [{ ...cat, subcategories }] : [];
    });
    return categories.length ? [{ ...stage, categories }] : [];
  });
}
