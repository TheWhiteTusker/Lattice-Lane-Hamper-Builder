/** Quotation Register + Quote Details -> quote rows, reconciled against their lines. */

import { num, normalizePct } from "./pricing.ts";
import { body, cell, parseDate, type ImportInput } from "./import-cells.ts";

export function buildQuotes(input: ImportInput, warnings: string[]) {
  // ---- Quote Details first, so quote totals can be reconciled below
  const quoteLineCounter = new Map<string, number>();
  const quoteItems = body(input.quoteDetails)
    .map((row) => {
      const docNo = cell(row, 0);
      const lineNo = (quoteLineCounter.get(docNo) ?? 0) + 1;
      quoteLineCounter.set(docNo, lineNo);

      return {
        doc_no: docNo,
        line_no: lineNo,
        option_label: cell(row, 1) || null,
        hamper_code: cell(row, 2) || null,
        hamper_name: cell(row, 3) || null,
        qty: num(cell(row, 4)),
        catalogue_price: num(cell(row, 5)),
        discount_pct: normalizePct(cell(row, 6)),
        detail_mode: cell(row, 9) || null,
        packaging_treatment: cell(row, 10) || null,
      };
    })
    .filter((i) => i.doc_no);

  // ---- Quotation Register
  let unparsedDates = 0;

  const quotes = body(input.quotationRegister)
    .map((row) => {
      const docNo = cell(row, 0);
      const quotedValue = num(cell(row, 11)); // L, the taxable value
      const gstAmount = num(cell(row, 12)); // M

      const docDate = parseDate(cell(row, 2));
      if (cell(row, 2) && !docDate) unparsedDates++;

      // The register stored the taxable value but never the discount or the
      // extra charges that produced it (they lived in the Builder, not a
      // saved sheet). Re-derive one adjustment so the historical total still
      // reconciles against the line items.
      const subtotal = quoteItems
        .filter((i) => i.doc_no === docNo)
        .reduce((sum, i) => sum + i.qty * i.catalogue_price * (1 - i.discount_pct), 0);

      const delta = quotedValue ? quotedValue - subtotal : 0;

      return {
        doc_no: docNo,
        doc_type: /proforma/i.test(cell(row, 1))
          ? ("proforma_invoice" as const)
          : ("quotation" as const),
        doc_date: docDate,
        client_name: cell(row, 3),
        contact_person: cell(row, 4) || null,
        phone: cell(row, 5) || null,
        email: cell(row, 6) || null,
        occasion: cell(row, 7) || null,
        quote_structure: cell(row, 8) || "Combined Order",
        status: cell(row, 14) || "Draft",
        validity: cell(row, 15) || null,
        follow_up_date: parseDate(cell(row, 16)),
        notes: cell(row, 17) || null,
        linked_doc_no: cell(row, 19) || null,
        // Recover the rate actually charged rather than assuming 18%.
        gst_rate: quotedValue > 0 && gstAmount > 0 ? round4(gstAmount / quotedValue) : 0.18,
        order_discount: delta < -0.005 ? Math.abs(delta) : 0,
        adj1: delta > 0.005 ? delta : 0,
        adj2: 0,
      };
    })
    .filter((q) => q.doc_no && q.client_name);

  if (unparsedDates) {
    warnings.push(
      `${unparsedDates} date(s) in the Quotation Register could not be read and were left blank.`,
    );
  }

  const reconciled = quotes.filter((q) => q.order_discount > 0 || q.adj1 > 0).length;
  if (reconciled) {
    warnings.push(
      `${reconciled} quotation(s) had a total that differs from the sum of their lines. The difference was recorded as an order discount or an extra charge so the original total is preserved.`,
    );
  }

  const quoteNos = new Set(quotes.map((q) => q.doc_no));
  const orphanQuoteLines = [
    ...new Set(quoteItems.filter((i) => !quoteNos.has(i.doc_no)).map((i) => i.doc_no)),
  ];
  if (orphanQuoteLines.length) {
    warnings.push(
      `Quote Details refers to documents missing from the Quotation Register, these lines are skipped: ${orphanQuoteLines.join(", ")}`,
    );
  }

  return { quotes, quoteItems: quoteItems.filter((i) => quoteNos.has(i.doc_no)) };
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;
