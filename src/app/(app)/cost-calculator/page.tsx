import { redirect } from "next/navigation";
import { costingHref } from "./href";

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CostCalculatorPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;

  // Old links: the master and each product's costing have their own routes.
  if (one(params.tab) === "master") redirect("/cost-calculator/master");
  const product = one(params.product).trim();
  if (product) redirect(costingHref(product));

  const saved = one(params.saved);
  const t = one(params.t);
  const qs = new URLSearchParams();
  if (saved) qs.set("saved", saved);
  if (t) qs.set("t", t);
  const query = qs.toString();

  redirect(query ? `/products/new?${query}` : "/products/new");
}
