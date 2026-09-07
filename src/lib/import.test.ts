import { test } from "node:test";
import assert from "node:assert/strict";
import { buildImport, parseDate } from "./import.ts";

const header = (n: number) => Array.from({ length: n }, (_, i) => `col${i}`);

test("dates read ISO and Indian day-first formats", () => {
  assert.equal(parseDate("2025-03-09"), "2025-03-09");
  assert.equal(parseDate("9/3/2025"), "2025-03-09");
  assert.equal(parseDate("09-03-2025"), "2025-03-09");
  assert.equal(parseDate(""), null);
});

test("settings map categories and the counts-as-item flag", () => {
  const result = buildImport({
    settings: [
      header(8),
      ["Dry Fruits", "Yes", "", "", "", "", "", "Show Contents"],
      ["Inside Packaging", "No"],
      ["Chocolate", ""], // blank defaults to counting
    ],
  });

  assert.deepEqual(
    result.categories.map((c) => [c.name, c.counts_as_item]),
    [
      ["Dry Fruits", true],
      ["Inside Packaging", false],
      ["Chocolate", true],
    ],
  );
  assert.equal(result.defaultDetailMode, "Show Contents");
});

test("product master maps by column position and normalises the margin", () => {
  const result = buildImport({
    products: [
      header(8),
      ["P001", "Dry Fruits", "Almonds 250g", "Vendor A", "250", "35", "400", "Yes"],
      ["P002", "Chocolate", "Truffle Box", "Vendor B", "120", "0.4", "200", "No"],
    ],
  });

  assert.equal(result.products.length, 2);
  assert.deepEqual(result.products[0], {
    code: "P001",
    category_name: "Dry Fruits",
    name: "Almonds 250g",
    source: "Vendor A",
    cost_price: 250,
    target_margin: 0.35, // "35" became a fraction
    default_sp: 400,
    is_active: true,
  });
  assert.equal(result.products[1].target_margin, 0.4); // already a fraction
  assert.equal(result.products[1].is_active, false);
});

test("hamper summary keeps only the input columns", () => {
  const result = buildImport({
    hamperSummary: [
      header(16),
      // code name coll status items CP baseSP disc afterDisc target var final GP margin notes date
      ["H001", "Festive Box", "Diwali", "Approved", "5", "950", "1550", "10", "1395", "1300", "95", "1500", "550", "0.3667", "VIP client", "2025-01-05"],
    ],
  });

  assert.deepEqual(result.hampers[0], {
    code: "H001",
    name: "Festive Box",
    collection: "Diwali",
    status: "Approved",
    discount_pct: 0.1,
    target_sp: 1300,
    final_catalogue_sp: 1500,
    notes: "VIP client",
  });
});

test("hamper detail lines are numbered per hamper and orphans are dropped", () => {
  const result = buildImport({
    hamperSummary: [header(16), ["H001", "Festive Box"]],
    hamperDetails: [
      header(15),
      ["H001", "Festive Box", "", "", "P001", "Dry Fruits", "Almonds", "2", "Vendor A", "250", "500", "35", "400", "800", ""],
      ["H001", "Festive Box", "", "", "P002", "Chocolate", "Truffles", "3", "Vendor B", "120", "360", "40", "200", "600", ""],
      ["H999", "Ghost", "", "", "P001", "Dry Fruits", "Almonds", "1", "", "250", "250", "35", "400", "400", ""],
    ],
  });

  assert.equal(result.hamperItems.length, 2); // H999 has no summary row
  assert.deepEqual(
    result.hamperItems.map((i) => i.line_no),
    [1, 2],
  );
  assert.equal(result.hamperItems[0].qty, 2);
  assert.equal(result.hamperItems[0].unit_cp, 250);
  assert.equal(result.hamperItems[0].unit_sp, 400);
  assert.ok(result.warnings.some((w) => w.includes("H999")));
});

test("quote totals that do not match their lines are reconciled, not lost", () => {
  // Lines add up to 10000, but the register recorded a taxable value of 9500:
  // the missing 500 was an order discount entered in the Builder and never saved.
  const result = buildImport({
    quotationRegister: [
      header(20),
      ["LLQT-001", "Quotation", "05/01/2025", "Acme Ltd", "Ravi", "999", "a@b.com", "Diwali", "Combined Order", "1", "10", "9500", "1710", "11210", "Sent", "15 Days", "", "note", "", ""],
    ],
    quoteDetails: [
      header(11),
      ["LLQT-001", "Option 1", "H001", "Festive Box", "10", "1000", "0", "1000", "10000", "Show Contents", "Absorb into Box & Packaging"],
    ],
  });

  const quote = result.quotes[0];
  assert.equal(quote.doc_no, "LLQT-001");
  assert.equal(quote.doc_date, "2025-01-05");
  assert.equal(quote.order_discount, 500); // 10000 - 9500
  assert.equal(quote.adj1, 0);
  assert.equal(quote.gst_rate, 0.18); // 1710 / 9500
  assert.ok(result.warnings.some((w) => w.includes("differs from the sum")));
});

test("an extra charge is recovered the same way", () => {
  const result = buildImport({
    quotationRegister: [
      header(20),
      ["LLQT-002", "Proforma Invoice", "", "Beta Corp", "", "", "", "", "Combined Order", "1", "1", "10500", "", "", "Draft", "", "", "", "", "LLQT-001"],
    ],
    quoteDetails: [
      header(11),
      ["LLQT-002", "", "H001", "Festive Box", "10", "1000", "0", "1000", "10000", "", ""],
    ],
  });

  assert.equal(result.quotes[0].doc_type, "proforma_invoice");
  assert.equal(result.quotes[0].adj1, 500);
  assert.equal(result.quotes[0].order_discount, 0);
  assert.equal(result.quotes[0].linked_doc_no, "LLQT-001");
});

test("counts describe exactly what will be written", () => {
  const result = buildImport({
    settings: [header(8), ["Dry Fruits", "Yes"]],
    products: [header(8), ["P001", "Dry Fruits", "Almonds", "", "250", "35", "400", "Yes"]],
    hamperSummary: [header(16), ["H001", "Festive Box"]],
    hamperDetails: [
      header(15),
      ["H001", "", "", "", "P001", "Dry Fruits", "Almonds", "2", "", "250", "", "35", "400", "", ""],
    ],
  });

  assert.deepEqual(result.counts, {
    categories: 1,
    products: 1,
    hampers: 1,
    hamperItems: 1,
    quotes: 0,
    quoteItems: 0,
  });
});
