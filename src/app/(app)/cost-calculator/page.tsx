import { redirect } from "next/navigation";
import { CalculatorScreen } from "./calculator-screen";
import { costingHref } from "./href";

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CostCalculatorPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;

  // Old links: the master and each product's costing now have their own routes.
  if (one(params.tab) === "master") redirect("/cost-calculator/master");
  const product = one(params.product).trim();
  if (product) redirect(costingHref(product));

  return <CalculatorScreen saved={one(params.saved) || undefined} t={one(params.t)} />;
}
