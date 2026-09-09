"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { saveQuote, deleteQuote, convertToProforma } from "./actions";
import { priceQuote, priceQuoteLine, formatMoney, num, round2, COMBINED_ORDER } from "@/lib/pricing";
import { HamperContents, type ContentItem } from "@/components/hamper-contents";
import type { Quote, QuoteItem, Settings } from "@/lib/types";

export type HamperOption = {
  id: string;
  code: string;
  name: string;
  final_catalogue_sp: number | null;
  items: ContentItem[];
};

type Line = {
  key: string;
  option_label: string;
  hamper_id: string | null;
  hamper_code: string;
  hamper_name: string;
  qty: string;
  catalogue_price: string;
  discount_pct: string;
  detail_mode: string;
  packaging_treatment: string;
};

const toLine = (item: QuoteItem): Line => ({
  key: crypto.randomUUID(),
  option_label: item.option_label ?? "",
  hamper_id: item.hamper_id,
  hamper_code: item.hamper_code ?? "",
  hamper_name: item.hamper_name ?? "",
  qty: String(item.qty),
  catalogue_price: String(item.catalogue_price),
  discount_pct: String(round2(item.discount_pct * 100)),
  detail_mode: item.detail_mode ?? "",
  packaging_treatment: item.packaging_treatment ?? "",
});

const today = () => new Date().toISOString().slice(0, 10);

export function QuoteBuilder({
  quote,
  items,
  hampers,
  packagingCategories,
  settings,
  canEdit,
  canChangeStatus,
  initialHamperCode,
}: {
  quote?: Quote;
  items?: QuoteItem[];
  hampers: HamperOption[];
  packagingCategories: string[];
  settings: Settings;
  canEdit: boolean;
  canChangeStatus: boolean;
  initialHamperCode?: string;
}) {
  const [state, action, saving] = useActionState(saveQuote, {});
  const [delState, delAction, deleting] = useActionState(deleteQuote, {});
  const [convState, convAction, converting] = useActionState(convertToProforma, {});

  const [docType, setDocType] = useState(quote?.doc_type ?? "quotation");
  const [docDate, setDocDate] = useState(quote?.doc_date ?? today());
  const [clientName, setClientName] = useState(quote?.client_name ?? "");
  const [contactPerson, setContactPerson] = useState(quote?.contact_person ?? "");
  const [phone, setPhone] = useState(quote?.phone ?? "");
  const [email, setEmail] = useState(quote?.email ?? "");
  const [billingAddress, setBillingAddress] = useState(quote?.billing_address ?? "");
  const [gstin, setGstin] = useState(quote?.gstin ?? "");
  const [occasion, setOccasion] = useState(quote?.occasion ?? "");
  const [structure, setStructure] = useState(quote?.quote_structure ?? COMBINED_ORDER);
  const [validity, setValidity] = useState(quote?.validity ?? settings.default_validity);
  const [status, setStatus] = useState(quote?.status ?? "Draft");
  const [followUp, setFollowUp] = useState(quote?.follow_up_date ?? "");
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [terms, setTerms] = useState(quote?.terms ?? settings.quote_terms);

  const [orderDiscount, setOrderDiscount] = useState(String(quote?.order_discount ?? 0));
  const [adj1, setAdj1] = useState(String(quote?.adj1 ?? 0));
  const [adj2, setAdj2] = useState(String(quote?.adj2 ?? 0));
  const [gstRate, setGstRate] = useState(
    String(round2((quote?.gst_rate ?? settings.gst_rate) * 100)),
  );

  const [lines, setLines] = useState<Line[]>(() => {
    if (items?.length) return items.map(toLine);

    // Arrived from a hamper page via "Add to a quote".
    const seed = initialHamperCode && hampers.find((h) => h.code === initialHamperCode);
    return seed ? [lineFromHamper(seed, 1, settings)] : [];
  });

  const [picker, setPicker] = useState("");

  const isCombined = structure === COMBINED_ORDER;

  const totals = priceQuote(
    lines.map((l) => ({
      qty: num(l.qty),
      cataloguePrice: num(l.catalogue_price),
      discountPct: num(l.discount_pct) / 100,
    })),
    {
      quoteStructure: structure,
      orderDiscount: num(orderDiscount),
      adj1: num(adj1),
      adj2: num(adj2),
      gstRate: num(gstRate) / 100,
    },
  );

  function addHamper(hamperId: string) {
    const hamper = hampers.find((h) => h.id === hamperId);
    if (!hamper) return;
    setLines((prev) => [...prev, lineFromHamper(hamper, prev.length + 1, settings)]);
    setPicker("");
  }

  function update(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const alreadyAdded = useMemo(
    () => new Set(lines.map((l) => l.hamper_code)),
    [lines],
  );

  const contentsOf = useMemo(() => {
    const map = new Map(hampers.map((h) => [h.id, h.items]));
    return (hamperId: string | null) => (hamperId && map.get(hamperId)) || [];
  }, [hampers]);

  const payload = JSON.stringify({
    id: quote?.id ?? null,
    doc_type: docType,
    doc_date: docDate,
    client_name: clientName,
    contact_person: contactPerson || null,
    phone: phone || null,
    email: email || null,
    billing_address: billingAddress || null,
    gstin: gstin || null,
    occasion: occasion || null,
    quote_structure: structure,
    validity: validity || null,
    status,
    order_discount: num(orderDiscount),
    adj1: num(adj1),
    adj2: num(adj2),
    gst_rate: num(gstRate) / 100,
    notes: notes || null,
    terms: terms || null,
    follow_up_date: followUp || null,
    linked_doc_no: quote?.linked_doc_no ?? null,
    lines: lines.map((l) => ({
      option_label: l.option_label || null,
      hamper_id: l.hamper_id,
      hamper_code: l.hamper_code || null,
      hamper_name: l.hamper_name || null,
      qty: num(l.qty),
      catalogue_price: num(l.catalogue_price),
      discount_pct: num(l.discount_pct) / 100,
      detail_mode: l.detail_mode || null,
      packaging_treatment: l.packaging_treatment || null,
    })),
  });

  return (
    <>
      <form action={action} className="space-y-4">
        <input type="hidden" name="payload" value={payload} />

        {/* ---------------- document + client ---------------- */}
        <section className="card p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Document type" htmlFor="docType">
              <select
                id="docType"
                className="select mt-1"
                value={docType}
                onChange={(e) => setDocType(e.target.value as Quote["doc_type"])}
                disabled={!canEdit}
              >
                <option value="quotation">Quotation</option>
                <option value="proforma_invoice">Proforma Invoice</option>
              </select>
            </Field>

            <Field label="Date" htmlFor="docDate">
              <input
                id="docDate"
                type="date"
                className="input mt-1"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
                disabled={!canEdit}
              />
            </Field>

            <Field label="Status" htmlFor="status">
              <select
                id="status"
                className="select mt-1"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={!canEdit || !canChangeStatus}
              >
                {Array.from(new Set([...settings.quote_statuses, status])).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {!canChangeStatus && (
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Only a manager can change status.
                </p>
              )}
            </Field>

            <Field label="Client / company" htmlFor="clientName">
              <input
                id="clientName"
                className="input mt-1"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                disabled={!canEdit}
                required
              />
            </Field>

            <Field label="Contact person" htmlFor="contactPerson">
              <input
                id="contactPerson"
                className="input mt-1"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                disabled={!canEdit}
              />
            </Field>

            <Field label="Occasion / project" htmlFor="occasion">
              <input
                id="occasion"
                className="input mt-1"
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                disabled={!canEdit}
              />
            </Field>

            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                className="input mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!canEdit}
              />
            </Field>

            <Field label="Phone" htmlFor="phone">
              <input
                id="phone"
                className="input mt-1"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!canEdit}
              />
            </Field>

            <Field label="GSTIN" htmlFor="gstin">
              <input
                id="gstin"
                className="input mt-1 font-mono"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                disabled={!canEdit}
              />
            </Field>

            <Field label="Billing address" htmlFor="billingAddress" className="md:col-span-2">
              <textarea
                id="billingAddress"
                rows={2}
                className="input mt-1"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                disabled={!canEdit}
              />
            </Field>

            <div className="grid gap-4">
              <Field label="Validity" htmlFor="validity">
                <input
                  id="validity"
                  list="validity-options"
                  className="input mt-1"
                  value={validity}
                  onChange={(e) => setValidity(e.target.value)}
                  disabled={!canEdit}
                />
                <datalist id="validity-options">
                  {settings.validity_options.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </Field>

              <Field label="Follow up on" htmlFor="followUp">
                <input
                  id="followUp"
                  type="date"
                  className="input mt-1"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* ---------------- hamper lines ---------------- */}
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-2.5">
            <div>
              <h2 className="text-sm font-semibold">Hampers</h2>
              <p className="text-xs text-[var(--color-muted)]">
                {isCombined
                  ? "Combined order — every line is part of one total."
                  : "Option based — the client picks one line, so there is no order total."}
              </p>
            </div>

            <div className="flex items-end gap-2">
              <div>
                <label className="label" htmlFor="structure">
                  Structure
                </label>
                <select
                  id="structure"
                  className="select mt-1"
                  value={structure}
                  onChange={(e) => setStructure(e.target.value)}
                  disabled={!canEdit}
                >
                  {Array.from(new Set([...settings.quote_structures, structure])).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {canEdit && (
                <div>
                  <label className="label" htmlFor="picker">
                    Add hamper
                  </label>
                  <select
                    id="picker"
                    className="select mt-1 min-w-[240px]"
                    value={picker}
                    onChange={(e) => addHamper(e.target.value)}
                  >
                    <option value="">Select a hamper…</option>
                    {hampers.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.code} — {h.name}
                        {alreadyAdded.has(h.code) ? " (already added)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
              No hampers yet. Add one above to start the quotation.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table min-w-[1100px]">
                <thead>
                  <tr>
                    <th className="w-[110px]">Option</th>
                    <th className="w-[240px]">Hamper</th>
                    <th className="w-[80px] num">Qty</th>
                    <th className="w-[120px] num">Catalogue price</th>
                    <th className="w-[90px] num">Discount %</th>
                    <th className="w-[120px] num">Final rate</th>
                    <th className="w-[120px] num">Amount</th>
                    <th className="w-[150px]">Contents shown</th>
                    <th className="w-[190px]">Packaging</th>
                    {canEdit && <th className="w-[40px]"></th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const { finalRate, amount } = priceQuoteLine({
                      qty: num(line.qty),
                      cataloguePrice: num(line.catalogue_price),
                      discountPct: num(line.discount_pct) / 100,
                    });

                    return (
                      <tr key={line.key} className="[&>td]:align-top">
                        <td>
                          <input
                            aria-label="Option label"
                            className="input"
                            value={line.option_label}
                            disabled={!canEdit}
                            onChange={(e) => update(line.key, { option_label: e.target.value })}
                          />
                        </td>
                        <td>
                          <div className="font-medium">{line.hamper_name}</div>
                          <div className="font-mono text-xs text-[var(--color-muted)]">
                            {line.hamper_code}
                          </div>
                          {/* Read-only preview of what the printed document
                              will list for this line. */}
                          <HamperContents
                            className="text-xs"
                            items={contentsOf(line.hamper_id)}
                            detailMode={line.detail_mode}
                            packagingTreatment={line.packaging_treatment}
                            packagingCategories={packagingCategories}
                          />
                        </td>
                        <td>
                          <input
                            aria-label="Quantity"
                            inputMode="decimal"
                            className="input input-num"
                            value={line.qty}
                            disabled={!canEdit}
                            onChange={(e) => update(line.key, { qty: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            aria-label="Catalogue price"
                            inputMode="decimal"
                            className="input input-num"
                            value={line.catalogue_price}
                            disabled={!canEdit}
                            onChange={(e) =>
                              update(line.key, { catalogue_price: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label="Discount percent"
                            inputMode="decimal"
                            className="input input-num"
                            value={line.discount_pct}
                            disabled={!canEdit}
                            onChange={(e) => update(line.key, { discount_pct: e.target.value })}
                          />
                        </td>
                        <td className="num text-[var(--color-muted)]">{formatMoney(finalRate)}</td>
                        <td className="num font-medium">{formatMoney(amount)}</td>
                        <td>
                          <select
                            aria-label="Contents shown"
                            className="select"
                            value={line.detail_mode}
                            disabled={!canEdit}
                            onChange={(e) => update(line.key, { detail_mode: e.target.value })}
                          >
                            {Array.from(
                              new Set([...settings.detail_modes, line.detail_mode].filter(Boolean)),
                            ).map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            aria-label="Packaging treatment"
                            className="select"
                            value={line.packaging_treatment}
                            disabled={!canEdit}
                            onChange={(e) =>
                              update(line.key, { packaging_treatment: e.target.value })
                            }
                          >
                            {Array.from(
                              new Set(
                                [
                                  ...settings.packaging_treatments,
                                  line.packaging_treatment,
                                ].filter(Boolean),
                              ),
                            ).map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </td>
                        {canEdit && (
                          <td className="num">
                            <button
                              type="button"
                              aria-label={`Remove ${line.hamper_code}`}
                              onClick={() =>
                                setLines((prev) => prev.filter((l) => l.key !== line.key))
                              }
                              className="rounded px-1.5 py-0.5 text-[var(--color-muted)] hover:bg-red-50 hover:text-red-700"
                            >
                              ×
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---------------- totals + terms ---------------- */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h2 className="text-sm font-semibold">Notes and terms</h2>

            <div className="mt-3 space-y-3">
              <Field label="Internal notes" htmlFor="notes">
                <textarea
                  id="notes"
                  rows={2}
                  className="input mt-1"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canEdit}
                />
              </Field>

              <Field label="Terms printed on the quotation" htmlFor="terms">
                <textarea
                  id="terms"
                  rows={5}
                  className="input mt-1"
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  disabled={!canEdit}
                />
              </Field>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-semibold">Order total</h2>

            {!isCombined ? (
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                Option-based quotations have no combined total. Each line is priced on its
                own so the client can choose between them.
              </p>
            ) : (
              <>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
                </dl>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field label="Order discount" htmlFor="orderDiscount">
                    <input
                      id="orderDiscount"
                      inputMode="decimal"
                      className="input input-num mt-1"
                      value={orderDiscount}
                      onChange={(e) => setOrderDiscount(e.target.value)}
                      disabled={!canEdit}
                    />
                  </Field>
                  <Field label="Packaging / freight" htmlFor="adj1">
                    <input
                      id="adj1"
                      inputMode="decimal"
                      className="input input-num mt-1"
                      value={adj1}
                      onChange={(e) => setAdj1(e.target.value)}
                      disabled={!canEdit}
                    />
                  </Field>
                  <Field label="Other charges" htmlFor="adj2">
                    <input
                      id="adj2"
                      inputMode="decimal"
                      className="input input-num mt-1"
                      value={adj2}
                      onChange={(e) => setAdj2(e.target.value)}
                      disabled={!canEdit}
                    />
                  </Field>
                </div>

                <dl className="mt-4 space-y-1.5 text-sm">
                  <Row label="Taxable value" value={formatMoney(totals.taxableValue)} />
                </dl>

                <div className="mt-3">
                  <Field label="GST %" htmlFor="gstRate">
                    <input
                      id="gstRate"
                      inputMode="decimal"
                      className="input input-num mt-1 max-w-[120px]"
                      value={gstRate}
                      onChange={(e) => setGstRate(e.target.value)}
                      disabled={!canEdit}
                    />
                  </Field>
                </div>

                <dl className="mt-4 space-y-1.5 border-t border-[var(--color-line)] pt-3 text-sm">
                  <Row label="GST" value={formatMoney(totals.gstAmount)} />
                  <Row label="Grand total" value={formatMoney(totals.grandTotal)} strong />
                </dl>
              </>
            )}
          </div>
        </section>

        {(state.error || delState.error || convState.error) && (
          <p role="alert" className="text-sm text-red-700">
            {state.error || delState.error || convState.error}
          </p>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : quote ? "Save changes" : "Create quotation"}
            </button>
            <Link href="/quotes" className="btn-secondary">
              Cancel
            </Link>
          </div>
        )}
      </form>

      {quote && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={`/quotes/${encodeURIComponent(quote.doc_no)}/print`} className="btn-secondary">
            Print / PDF
          </Link>

          {canEdit && quote.doc_type === "quotation" && (
            <form action={convAction}>
              <input type="hidden" name="doc_no" value={quote.doc_no} />
              <button type="submit" className="btn-secondary" disabled={converting}>
                {converting ? "Converting…" : "Convert to proforma invoice"}
              </button>
            </form>
          )}

          {canEdit && (
            <form action={delAction} className="ml-auto">
              <input type="hidden" name="id" value={quote.id} />
              <button type="submit" className="btn-danger" disabled={deleting}>
                {deleting ? "Deleting…" : "Delete quotation"}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}

function lineFromHamper(hamper: HamperOption, index: number, settings: Settings): Line {
  return {
    key: crypto.randomUUID(),
    option_label: `Option ${index}`,
    hamper_id: hamper.id,
    hamper_code: hamper.code,
    hamper_name: hamper.name,
    qty: "1",
    catalogue_price: String(hamper.final_catalogue_sp ?? 0),
    discount_pct: "0",
    detail_mode: settings.default_detail_mode,
    packaging_treatment: settings.default_packaging_treatment,
  };
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({
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
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-base font-semibold" : "font-medium"}`}>
        {value || "—"}
      </dd>
    </div>
  );
}
