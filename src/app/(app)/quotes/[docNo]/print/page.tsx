import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/settings";
import { formatMoney, formatPct, priceQuote, COMBINED_ORDER } from "@/lib/pricing";
import { PrintButton } from "./print-button";
import { HamperContents } from "@/components/hamper-contents";
import type { Category, HamperItem, QuoteItem, QuoteSummary } from "@/lib/types";

export default async function PrintQuotePage({
  params,
}: {
  params: Promise<{ docNo: string }>;
}) {
  const { docNo } = await params;
  const { supabase } = await requireUser();

  const { data: quote } = await supabase
    .from("quote_summary")
    .select("*")
    .eq("doc_no", decodeURIComponent(docNo))
    .maybeSingle<QuoteSummary>();

  if (!quote) notFound();

  const [{ data: lines }, settings, { data: categories }] = await Promise.all([
    supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("line_no")
      .returns<QuoteItem[]>(),
    loadSettings(supabase),
    supabase.from("categories").select("*").returns<Category[]>(),
  ]);

  const hamperIds = (lines ?? [])
    .map((l) => l.hamper_id)
    .filter((id): id is string => !!id);

  const { data: contents } = hamperIds.length
    ? await supabase
        .from("hamper_items")
        .select("*")
        .in("hamper_id", hamperIds)
        .order("line_no")
        .returns<HamperItem[]>()
    : { data: [] as HamperItem[] };

  const byHamper = new Map<string, HamperItem[]>();
  for (const item of contents ?? []) {
    const list = byHamper.get(item.hamper_id) ?? [];
    list.push(item);
    byHamper.set(item.hamper_id, list);
  }

  // Packaging-type categories are the ones Settings marks as not counting
  // toward "No. of Items" - the box, the filler, the ribbon.
  const packagingCategories = (categories ?? [])
    .filter((c) => !c.counts_as_item)
    .map((c) => c.name);

  const totals = priceQuote(
    (lines ?? []).map((l) => ({
      qty: l.qty,
      cataloguePrice: l.catalogue_price,
      discountPct: l.discount_pct,
    })),
    {
      quoteStructure: quote.quote_structure,
      orderDiscount: quote.order_discount,
      adj1: quote.adj1,
      adj2: quote.adj2,
      gstRate: quote.gst_rate,
    },
  );

  const isCombined = quote.quote_structure === COMBINED_ORDER;
  const title = quote.doc_type === "proforma_invoice" ? "Proforma Invoice" : "Quotation";
  const company = settings.company;

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/quotes/${encodeURIComponent(quote.doc_no)}`} className="btn-secondary">
          Back to quotation
        </Link>
        <PrintButton />
        <p className="text-sm text-[var(--color-muted)]">
          Print, then choose “Save as PDF” to send this to a client.
        </p>
      </div>

      <article className="print-sheet card mx-auto max-w-[820px] p-10 text-[13px] leading-relaxed">
        {/* ---------------- letterhead ---------------- */}
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[var(--color-line)] pb-5">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{company.name}</h1>
            {company.address && (
              <p className="mt-1 whitespace-pre-line text-[var(--color-muted)]">
                {company.address}
              </p>
            )}
            <p className="mt-1 text-[var(--color-muted)]">
              {[company.phone, company.email, company.website].filter(Boolean).join("  ·  ")}
            </p>
            {company.gstin && (
              <p className="mt-1 text-[var(--color-muted)]">GSTIN: {company.gstin}</p>
            )}
          </div>

          <div className="text-right">
            <h2 className="text-base font-semibold uppercase tracking-wide">{title}</h2>
            <p className="mt-1 font-mono text-sm">{quote.doc_no}</p>
            <p className="text-[var(--color-muted)]">{quote.doc_date}</p>
            {quote.validity && (
              <p className="text-[var(--color-muted)]">Valid for {quote.validity}</p>
            )}
            {quote.linked_doc_no && (
              <p className="text-[var(--color-muted)]">Against {quote.linked_doc_no}</p>
            )}
          </div>
        </header>

        {/* ---------------- client ---------------- */}
        <section className="mt-5 flex flex-wrap justify-between gap-6">
          <div>
            <div className="label">Prepared for</div>
            <p className="mt-1 font-medium">{quote.client_name}</p>
            {quote.contact_person && <p>{quote.contact_person}</p>}
            {quote.billing_address && (
              <p className="whitespace-pre-line text-[var(--color-muted)]">
                {quote.billing_address}
              </p>
            )}
            <p className="text-[var(--color-muted)]">
              {[quote.phone, quote.email].filter(Boolean).join("  ·  ")}
            </p>
            {quote.gstin && <p className="text-[var(--color-muted)]">GSTIN: {quote.gstin}</p>}
          </div>

          {quote.occasion && (
            <div className="text-right">
              <div className="label">Occasion</div>
              <p className="mt-1">{quote.occasion}</p>
            </div>
          )}
        </section>

        {!isCombined && (
          <p className="mt-5 rounded-md bg-[var(--color-brand-soft)] px-3 py-2 text-[var(--color-brand-dark)]">
            The options below are priced individually. Please select the one you would like
            to proceed with.
          </p>
        )}

        {/* ---------------- lines ---------------- */}
        <table className="table mt-5">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Hamper</th>
              <th className="num w-16">Qty</th>
              <th className="num w-24">Rate</th>
              <th className="num w-24">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((line, index) => {
              const items = line.hamper_id ? (byHamper.get(line.hamper_id) ?? []) : [];

              return (
                <tr key={line.id} className="avoid-break align-top">
                  <td className="text-[var(--color-muted)]">
                    {line.option_label || index + 1}
                  </td>

                  <td>
                    <div className="font-medium">{line.hamper_name}</div>

                    <HamperContents
                      items={items}
                      detailMode={line.detail_mode}
                      packagingTreatment={line.packaging_treatment}
                      packagingCategories={packagingCategories}
                    />
                  </td>

                  <td className="num">{line.qty}</td>

                  <td className="num">
                    {formatMoney(line.final_rate)}
                    {Number(line.discount_pct) > 0 && (
                      <div className="text-xs text-[var(--color-muted)] line-through">
                        {formatMoney(line.catalogue_price)}
                      </div>
                    )}
                  </td>

                  <td className="num font-medium">{formatMoney(line.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ---------------- totals ---------------- */}
        {isCombined && (
          <section className="mt-5 flex justify-end">
            <dl className="w-full max-w-[320px] space-y-1">
              <TotalRow label="Subtotal" value={formatMoney(totals.subtotal)} />
              {quote.order_discount > 0 && (
                <TotalRow
                  label="Order discount"
                  value={`− ${formatMoney(quote.order_discount)}`}
                />
              )}
              {quote.adj1 > 0 && (
                <TotalRow label="Packaging / freight" value={formatMoney(quote.adj1)} />
              )}
              {quote.adj2 > 0 && (
                <TotalRow label="Other charges" value={formatMoney(quote.adj2)} />
              )}
              <TotalRow label="Taxable value" value={formatMoney(totals.taxableValue)} />
              <TotalRow
                label={`GST @ ${formatPct(quote.gst_rate, 0)}`}
                value={formatMoney(totals.gstAmount)}
              />
              <div className="mt-1 border-t border-[var(--color-line)] pt-1">
                <TotalRow label="Grand total" value={formatMoney(totals.grandTotal)} strong />
              </div>
            </dl>
          </section>
        )}

        {/* ---------------- terms ---------------- */}
        {quote.terms && (
          <section className="avoid-break mt-8 border-t border-[var(--color-line)] pt-4">
            <div className="label">Terms</div>
            <p className="mt-1 whitespace-pre-line text-[var(--color-muted)]">{quote.terms}</p>
          </section>
        )}

        <footer className="mt-8 text-center text-xs text-[var(--color-muted)]">
          {company.name}
          {company.website ? `  ·  ${company.website}` : ""}
        </footer>
      </article>
    </>
  );
}

function TotalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-semibold" : "text-[var(--color-muted)]"}>{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-base font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}
