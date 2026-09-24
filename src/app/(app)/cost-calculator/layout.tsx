import { PageHeader } from "@/components/ui";
import { CostTabs } from "./tabs";

export default function CostCalculatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        title="Product Cost Calculator"
        subtitle="Stage-by-stage costing engine: Material, Hardware, Finishing & Machine per-minute costs"
      >
        <CostTabs />
      </PageHeader>
      {children}
    </>
  );
}
