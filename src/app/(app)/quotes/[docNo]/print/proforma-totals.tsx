import { formatMoney, round2, type QuotePricing } from "@/lib/pricing";
import type { CompanySettings, QuoteSummary } from "@/lib/types";

export const line = "border-neutral-400";

/** Sub total, adjustments, the GST split and grand total, ruled like the sheet. */
export function ProformaTotals({
  quote,
  company,
  totals,
}: {
  quote: QuoteSummary;
  company: CompanySettings;
  totals: QuotePricing;
}) {
  const taxable = totals.taxableValue ?? 0;
  const gst = totals.gstAmount ?? 0;
  const grand = totals.grandTotal ?? 0;

  // GSTIN starts with the state code: same state splits into CGST + SGST,
  // a different state is IGST. No client GSTIN is treated as same state.
  const interState =
    !!quote.gstin && !!company.gstin && quote.gstin.slice(0, 2) !== company.gstin.slice(0, 2);
  const pct = (rate: number) => `${round2(rate * 100)}%`;
  const hasAdjustments = quote.order_discount > 0 || quote.adj1 > 0 || quote.adj2 > 0;

  return (
    <>
      <TotalLine label="Sub Total" value={formatMoney(totals.subtotal)} />
      {quote.order_discount > 0 && (
        <TotalLine label="Discount" value={`− ${formatMoney(quote.order_discount)}`} />
      )}
      {quote.adj1 > 0 && <TotalLine label="Packaging / Freight" value={formatMoney(quote.adj1)} />}
      {quote.adj2 > 0 && <TotalLine label="Other Charges" value={formatMoney(quote.adj2)} />}
      {hasAdjustments && <TotalLine label="Taxable Value" value={formatMoney(taxable)} />}
      {interState ? (
        <TotalLine label={`IGST@${pct(quote.gst_rate)}`} value={formatMoney(gst)} />
      ) : (
        <>
          <TotalLine label={`CGST@${pct(quote.gst_rate / 2)}`} value={formatMoney(gst / 2)} />
          <TotalLine label={`SGST@${pct(quote.gst_rate / 2)}`} value={formatMoney(gst / 2)} />
        </>
      )}
      <TotalLine label="Grand Total" value={formatMoney(grand)} strong />
    </>
  );
}

function TotalLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex border-b ${line} ${strong ? "bg-neutral-300 text-lg font-bold" : "text-sm"}`}
    >
      <div className={`flex-1 border-r ${line} px-2 py-1 text-right uppercase`}>{label}</div>
      <div className="w-32 px-2 py-1 text-right tabular-nums">{value}</div>
    </div>
  );
}
