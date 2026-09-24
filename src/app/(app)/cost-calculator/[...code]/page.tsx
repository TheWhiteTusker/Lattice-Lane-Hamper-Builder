import { CalculatorScreen } from "../calculator-screen";

export default async function ProductCostingPage({
  params,
}: {
  params: Promise<{ code: string[] }>;
}) {
  const { code } = await params;
  return <CalculatorScreen code={decodeURIComponent(code.join("/"))} />;
}
