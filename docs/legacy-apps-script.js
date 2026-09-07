function saveHamper() {

const ss = SpreadsheetApp.getActiveSpreadsheet();

const builder = ss.getSheetByName("Hamper Builder");
const details = ss.getSheetByName("Hamper Details");
const summary = ss.getSheetByName("Hamper Summary");

// -----------------------------
// HAMPER INFORMATION
// -----------------------------

const hamperCode = builder.getRange("B3").getValue();
const hamperName = builder.getRange("F3").getValue();
const collection = builder.getRange("B4").getValue();
const targetSP = builder.getRange("F4").getValue();
const status = builder.getRange("B5").getValue();
const notes = builder.getRange("F5").getValue();

// -----------------------------
// HAMPER TOTALS
// -----------------------------

const totalCP = builder.getRange("I26").getValue();
const baseSP = builder.getRange("I27").getValue();
const discount = builder.getRange("I28").getValue();
const afterDiscountSP = builder.getRange("I29").getValue();
const variance = builder.getRange("I33").getValue();
const finalSP = builder.getRange("I34").getValue();
const finalMargin = builder.getRange("I35").getValue();

// -----------------------------
// VALIDATION
// -----------------------------

if (!hamperCode) {
SpreadsheetApp.getUi().alert("Please enter a Hamper Code.");
return;
}

if (!hamperName) {
SpreadsheetApp.getUi().alert("Please enter a Hamper Name.");
return;
}

if (!finalSP) {
SpreadsheetApp.getUi().alert("Please enter the Final Catalogue SP.");
return;
}

// -----------------------------
// CHECK FOR DUPLICATE CODE
// -----------------------------

const summaryLastRow = summary.getLastRow();

if (summaryLastRow > 1) {

    const existingCodes = summary
      .getRange(2, 1, summaryLastRow - 1, 1)
      .getValues()
      .flat();

    if (existingCodes.includes(hamperCode)) {

      SpreadsheetApp.getUi().alert(
        "Hamper Code " + hamperCode + " already exists."
      );

      return;
    }

}

// -----------------------------
// READ PRODUCTS
// -----------------------------

const products = builder.getRange("A9:J23").getValues();

const rowsToSave = [];
const savedDate = new Date();

let numberOfItems = 0;

products.forEach(function(row) {

    const category = row[0];
    const product = row[1];
    const productCode = row[2];
    const qty = row[3];
    const source = row[4];
    const unitCP = row[5];
    const productTotalCP = row[6];
    const targetMargin = row[7];
    const unitSP = row[8];
    const productTotalSP = row[9];

    if (product) {

      rowsToSave.push([
        hamperCode,
        hamperName,
        collection,
        status,
        productCode,
        category,
        product,
        qty,
        source,
        unitCP,
        productTotalCP,
        targetMargin,
        unitSP,
        productTotalSP,
        savedDate
      ]);

      if (categoryCountsAsItem(category)) {

numberOfItems += Number(qty) || 0;
}
}

});

if (rowsToSave.length === 0) {

    SpreadsheetApp.getUi().alert(
      "Please select at least one product."
    );

    return;

}

// -----------------------------
// SAVE PRODUCT DETAILS
// -----------------------------

const detailsStartRow = details.getLastRow() + 1;

details
.getRange(
detailsStartRow,
1,
rowsToSave.length,
rowsToSave[0].length
)
.setValues(rowsToSave);

// -----------------------------
// CALCULATE FINAL PROFIT
// -----------------------------

const grossProfit = finalSP - totalCP;

// -----------------------------
// SAVE ONE SUMMARY ROW
// -----------------------------

summary.appendRow([
hamperCode,
hamperName,
collection,
status,
numberOfItems,
totalCP,
baseSP,
discount,
afterDiscountSP,
targetSP,
variance,
finalSP,
grossProfit,
finalMargin,
notes,
savedDate
]);

// -----------------------------
// CONFIRM
// -----------------------------

SpreadsheetApp.getUi().alert(
"Hamper " +
hamperCode +
" - " +
hamperName +
" saved successfully."
);

}

function onEdit(e) {

const sheet = e.range.getSheet();

// =====================================================
// QUOTE BUILDER
// Select Hamper in E7
// =====================================================

if (sheet.getName() === "Quote Builder") {

    const row = e.range.getRow();
    const column = e.range.getColumn();

    // E7 = Select Hamper
    if (row === 7 && column === 5) {

      const hamperCode =
        String(e.range.getValue()).trim();

      if (!hamperCode) return;

      addSelectedHamperToQuote(hamperCode);

      return;
    }

    return;

}

// =====================================================
// HAMPER BUILDER
// =====================================================

if (sheet.getName() !== "Hamper Builder") return;

const row = e.range.getRow();
const column = e.range.getColumn();

// =====================================================
// CATEGORY SELECTED
// A9:A23
// =====================================================

if (column === 1 && row >= 9 && row <= 23) {

    const category = e.range.getValue();

    const productCell =
      sheet.getRange(row, 2);

    // Clear previous product
    productCell.clearContent();
    productCell.clearDataValidations();

    if (!category) return;

    const ss = e.source;
    const master =
      ss.getSheetByName("Product Master");

    const lastRow =
      master.getLastRow();

    if (lastRow < 2) return;

    // Product Master:
    // B = Category
    // C = Product Name
    // H = Active

    const masterData =
      master
        .getRange(2, 2, lastRow - 1, 7)
        .getValues();

    const products =
      masterData
        .filter(function(row) {

          const masterCategory =
            String(row[0]).trim();

          const active =
            String(row[6])
              .trim()
              .toLowerCase();

          return (
            masterCategory ===
              String(category).trim() &&
            active === "yes"
          );

        })
        .map(function(row) {
          return row[1];
        })
        .filter(String);

    if (products.length === 0) {

      ss.toast(
        "No active products found under " +
        category
      );

      return;
    }

    const rule =
      SpreadsheetApp
        .newDataValidation()
        .requireValueInList(products, true)
        .setAllowInvalid(false)
        .build();

    productCell.setDataValidation(rule);

    return;

}

// =====================================================
// PRODUCT SELECTED
// B9:B23
// =====================================================

if (column === 2 && row >= 9 && row <= 23) {

    const product =
      String(e.range.getValue()).trim();

    if (!product) return;

    // Populate:
    // C = Product Code
    // E = Source
    // F = Unit CP
    // G = Total CP
    // H = Target Margin
    // I = Unit SP
    // J = Total SP

    populateProductRow(
      sheet,
      row,
      product
    );

    SpreadsheetApp.flush();

    return;

}

}

function newHamper() {

const ss = SpreadsheetApp.getActiveSpreadsheet();
const builder = ss.getSheetByName("Hamper Builder");
const ui = SpreadsheetApp.getUi();

// --------------------------------
// CONFIRM BEFORE CLEARING
// --------------------------------

const response = ui.alert(
"New Hamper",
"This will clear the current Hamper Builder. Make sure you have saved the current hamper first.",
ui.ButtonSet.YES_NO
);

if (response !== ui.Button.YES) {
return;
}

// --------------------------------
// CLEAR HAMPER INFORMATION
// --------------------------------

// Generate next hamper code
builder
.getRange("B3")
.setValue(getNextHamperCode());

// Hamper Name
builder
.getRange("F3")
.clearContent();

// Collection / Occasion
builder
.getRange("B4")
.clearContent();

// Target SP
builder
.getRange("F4")
.clearContent();

// Status
builder
.getRange("B5")
.setValue("Draft");

// Notes
builder
.getRange("F5")
.clearContent();

// Clear Load Hamper selector
builder
.getRange("I5")
.clearContent();

// --------------------------------
// CLEAR PRODUCT INPUT / POPULATED VALUES
// --------------------------------

// Category
builder
.getRange("A9:A23")
.clearContent();

// Product
builder
.getRange("B9:B23")
.clearContent()
.clearDataValidations();

// Product Code
builder
.getRange("C9:C23")
.clearContent();

// Quantity
builder
.getRange("D9:D23")
.clearContent();

// Source
builder
.getRange("E9:E23")
.clearContent();

// Unit CP
builder
.getRange("F9:F23")
.clearContent();

// Target Margin
builder
.getRange("H9:H23")
.clearContent();

// Unit SP
builder
.getRange("I9:I23")
.clearContent();

// --------------------------------
// KEEP CALCULATION FORMULAS
// G = Total CP
// J = Total SP
// --------------------------------

for (let row = 9; row <= 23; row++) {

    builder
      .getRange(row, 7)
      .setFormula(
        '=IF(OR(D' + row +
        '="",F' + row +
        '=""),"",D' + row +
        '*F' + row + ')'
      );

    builder
      .getRange(row, 10)
      .setFormula(
        '=IF(OR(D' + row +
        '="",I' + row +
        '=""),"",D' + row +
        '*I' + row + ')'
      );

}

// --------------------------------
// RESET HAMPER PRICING INPUTS
// --------------------------------

// Discount
builder
.getRange("I28")
.setValue(0);

// Final Catalogue SP
builder
.getRange("I34")
.clearContent();

// --------------------------------
// FORCE CALCULATION
// --------------------------------

SpreadsheetApp.flush();

// --------------------------------
// FINISHED
// --------------------------------

builder
.getRange("B3")
.activate();

ss.toast(
"Hamper Builder cleared. Ready for a new hamper.",
"New Hamper",
4
);

}

function getNextHamperCode() {

const ss = SpreadsheetApp.getActiveSpreadsheet();
const summary = ss.getSheetByName("Hamper Summary");

const lastRow = summary.getLastRow();

// No hampers saved yet
if (lastRow < 2) {
return "H001";
}

const codes = summary
.getRange(2, 1, lastRow - 1, 1)
.getValues()
.flat()
.filter(String);

let highestNumber = 0;

codes.forEach(function(code) {

    const match = String(code)
      .trim()
      .match(/^H(\d+)$/i);

    if (match) {

      const number = parseInt(match[1], 10);

      if (number > highestNumber) {
        highestNumber = number;
      }
    }

});

const nextNumber = highestNumber + 1;

return "H" + String(nextNumber).padStart(3, "0");
}

function loadHamper() {

const ss = SpreadsheetApp.getActiveSpreadsheet();

const builder = ss.getSheetByName("Hamper Builder");
const details = ss.getSheetByName("Hamper Details");
const summary = ss.getSheetByName("Hamper Summary");

const ui = SpreadsheetApp.getUi();

// --------------------------------
// READ SELECTED HAMPER
// --------------------------------

const hamperCode =
String(builder.getRange("I5").getDisplayValue()).trim();

if (!hamperCode) {
ui.alert("Please select a Hamper Code in I5.");
return;
}

// --------------------------------
// FIND HAMPER IN SUMMARY
// --------------------------------

const summaryLastRow = summary.getLastRow();

if (summaryLastRow < 2) {
ui.alert("No saved hampers found.");
return;
}

const summaryData = summary
.getRange(2, 1, summaryLastRow - 1, 16)
.getValues();

const hamperSummary = summaryData.find(function(row) {

    return String(row[0]).trim() === hamperCode;

});

if (!hamperSummary) {

    ui.alert(
      "Hamper " + hamperCode +
      " was not found in Hamper Summary."
    );

    return;

}

// --------------------------------
// IMPORTANT:
// SHOW THE SELECTED HAMPER
// IMMEDIATELY
// --------------------------------

builder.getRange("B3").setValue(hamperCode);

// --------------------------------
// LOAD HAMPER HEADER
// --------------------------------

builder.getRange("F3").setValue(hamperSummary[1]);
builder.getRange("B4").setValue(hamperSummary[2]);
builder.getRange("B5").setValue(hamperSummary[3]);
builder.getRange("F4").setValue(hamperSummary[9]);
builder.getRange("F5").setValue(hamperSummary[14]);

// --------------------------------
// LOAD PRICING
// --------------------------------

builder.getRange("I28").setValue(hamperSummary[7]);
builder.getRange("I34").setValue(hamperSummary[11]);

// --------------------------------
// FIND PRODUCTS
// --------------------------------

const detailsLastRow = details.getLastRow();

if (detailsLastRow < 2) {

    ui.alert("No Hamper Details found.");

    return;

}

const detailsData = details
.getRange(2, 1, detailsLastRow - 1, 15)
.getValues();

const hamperProducts = detailsData.filter(function(row) {

    return String(row[0]).trim() === hamperCode;

});

if (hamperProducts.length === 0) {

    ui.alert(
      "No products found for " +
      hamperCode + "."
    );

    return;

}

if (hamperProducts.length > 15) {

    ui.alert(
      "This hamper has more than 15 product lines."
    );

    return;

}

// --------------------------------
// CLEAR ONLY INPUT CELLS
// DO NOT CLEAR FORMULA CELLS
// --------------------------------

builder
.getRange("A9:A23")
.clearContent();

builder
.getRange("B9:B23")
.clearContent()
.clearDataValidations();

builder
.getRange("D9:D23")
.clearContent();

// --------------------------------
// LOAD PRODUCT CATEGORIES,
// PRODUCTS AND QUANTITIES
// --------------------------------

hamperProducts.forEach(function(row, index) {

    const builderRow = 9 + index;

    const category = row[5];
    const product = row[6];
    const qty = row[7];

    builder
      .getRange(builderRow, 1)
      .setValue(category);

    setProductDropdownForRow(
      builder,
      builderRow,
      category
    );

        builder
      .getRange(builderRow, 2)
      .setValue(product);

    builder
      .getRange(builderRow, 4)
      .setValue(qty);

    populateProductRow(
      builder,
      builderRow,
      product
    );

});

// --------------------------------
// FORCE CALCULATION
// --------------------------------

SpreadsheetApp.flush();

// --------------------------------
// FINISHED
// --------------------------------

ss.toast(
hamperCode +
" loaded into Hamper Builder.",
"Load Hamper",
4
);

}

function setProductDropdownForRow(builder, rowNumber, category) {

const ss = SpreadsheetApp.getActiveSpreadsheet();
const master = ss.getSheetByName("Product Master");

const lastRow = master.getLastRow();

if (lastRow < 2) return;

const masterData = master
.getRange(2, 2, lastRow - 1, 7)
.getValues();

const products = masterData
.filter(function(row) {

      const masterCategory = String(row[0]).trim();
      const active = String(row[6]).trim().toLowerCase();

      return (
        masterCategory === String(category).trim() &&
        active === "yes"
      );

    })
    .map(function(row) {
      return row[1];
    })
    .filter(String);

if (products.length === 0) return;

const rule = SpreadsheetApp
.newDataValidation()
.requireValueInList(products, true)
.setAllowInvalid(false)
.build();

builder
.getRange(rowNumber, 2)
.setDataValidation(rule);

}

function populateProductRow(builder, rowNumber, productName) {

const ss = SpreadsheetApp.getActiveSpreadsheet();
const master = ss.getSheetByName("Product Master");

if (!productName) {
return;
}

const lastRow = master.getLastRow();

if (lastRow < 2) {
return;
}

// Product Master:
// A = Product Code
// B = Category
// C = Product Name
// D = Source
// E = Cost Price
// F = Target Margin %
// G = Default SP
// H = Active

const masterData = master
.getRange(2, 1, lastRow - 1, 8)
.getValues();

const productRow = masterData.find(function(row) {

    return String(row[2]).trim() ===
           String(productName).trim();

});

if (!productRow) {
return;
}

const productCode = productRow[0];
const source = productRow[3];
const unitCP = Number(productRow[4]) || 0;
const targetMargin = Number(productRow[5]) || 0;
const unitSP = Number(productRow[6]) || 0;

// C = Product Code
builder
.getRange(rowNumber, 3)
.setValue(productCode);

// E = Source
builder
.getRange(rowNumber, 5)
.setValue(source);

// F = Unit CP
builder
.getRange(rowNumber, 6)
.setValue(unitCP);

// H = Target Margin %
builder
.getRange(rowNumber, 8)
.setValue(targetMargin);

// I = Unit SP
builder
.getRange(rowNumber, 9)
.setValue(unitSP);

// G = Total CP
builder
.getRange(rowNumber, 7)
.setFormula(
'=IF(OR(D' + rowNumber +
'="",F' + rowNumber +
'=""),"",D' + rowNumber +
'\*F' + rowNumber + ')'
);

// J = Total SP
builder
.getRange(rowNumber, 10)
.setFormula(
'=IF(OR(D' + rowNumber +
'="",I' + rowNumber +
'=""),"",D' + rowNumber +
'\*I' + rowNumber + ')'
);

}

function addSelectedHamperToQuote(hamperCode) {

const ss = SpreadsheetApp.getActiveSpreadsheet();

const quote = ss.getSheetByName("Quote Builder");
const summary = ss.getSheetByName("Hamper Summary");

const ui = SpreadsheetApp.getUi();

// -------------------------------------------------
// FIND HAMPER IN HAMPER SUMMARY
// -------------------------------------------------

const lastRow = summary.getLastRow();

if (lastRow < 2) {
ui.alert("No saved hampers found.");
return;
}

const summaryData = summary
.getRange(2, 1, lastRow - 1, 16)
.getValues();

const hamper = summaryData.find(function(row) {

    return String(row[0]).trim() ===
           String(hamperCode).trim();

});

if (!hamper) {

    ui.alert(
      "Hamper " + hamperCode +
      " was not found in Hamper Summary."
    );

    return;

}

// -------------------------------------------------
// CHECK IF ALREADY ADDED
// -------------------------------------------------

const existingCodes = quote
.getRange("B10:B19")
.getValues()
.flat();

const alreadyExists = existingCodes.some(function(code) {

    return String(code).trim() ===
           String(hamperCode).trim();

});

if (alreadyExists) {

    ui.alert(
      hamperCode +
      " is already added to this quotation."
    );

    return;

}

// -------------------------------------------------
// FIND NEXT EMPTY QUOTATION ROW
// -------------------------------------------------

let targetRow = null;

for (let row = 10; row <= 19; row++) {

    const code =
      quote.getRange(row, 2).getValue();

    if (!code) {

      targetRow = row;
      break;

    }

}

if (!targetRow) {

    ui.alert(
      "The Quote Builder already contains 10 hamper options."
    );

    return;

}

// -------------------------------------------------
// GET HAMPER INFORMATION
// -------------------------------------------------

const hamperName = hamper[1];

// Hamper Summary column L
// Final Selling Price / Catalogue Price
const cataloguePrice = Number(hamper[11]) || 0;

// -------------------------------------------------
// WRITE TO QUOTE BUILDER
// -------------------------------------------------

// B = Hamper Code
quote
.getRange(targetRow, 2)
.setValue(hamperCode);

// C = Hamper Name
quote
.getRange(targetRow, 3)
.setValue(hamperName);

// D = Qty
quote
.getRange(targetRow, 4)
.setValue(1);

// E = Catalogue Price
quote
.getRange(targetRow, 5)
.setValue(cataloguePrice);

// F = Discount %
quote
.getRange(targetRow, 6)
.setValue("");

// G = Final Rate
quote
.getRange(targetRow, 7)
.setFormula(
'=IF(E' + targetRow +
'="","",E' + targetRow +
'\*(1-IF(F' + targetRow +
'="",0,F' + targetRow + ')))'
);

// H = Amount
quote
.getRange(targetRow, 8)
.setFormula(
'=IF(OR(D' + targetRow +
'="",G' + targetRow +
'=""),"",D' + targetRow +
'\*G' + targetRow + ')'
);

// I = Detail Mode
quote
.getRange(targetRow, 9)
.setValue(
ss.getSheetByName("Settings").getRange("H2").getValue()
);

// J = Packaging Treatment
quote
.getRange(targetRow, 10)
.setValue("Absorb into Box & Packaging");

// -------------------------------------------------
// CLEAR SELECT HAMPER CELL
// READY FOR NEXT HAMPER
// -------------------------------------------------

quote
.getRange("E7")
.clearContent();

// -------------------------------------------------
// FINISHED
// -------------------------------------------------

ss.toast(
hamperCode +
" added to Quote Builder.",
"Add Hamper",
4
);

}

function updateHamper() {

const ss = SpreadsheetApp.getActiveSpreadsheet();

const builder = ss.getSheetByName("Hamper Builder");
const details = ss.getSheetByName("Hamper Details");
const summary = ss.getSheetByName("Hamper Summary");

const ui = SpreadsheetApp.getUi();

// --------------------------------
// READ HAMPER INFORMATION
// --------------------------------

const hamperCode = builder.getRange("B3").getValue();
const hamperName = builder.getRange("F3").getValue();
const collection = builder.getRange("B4").getValue();
const targetSP = builder.getRange("F4").getValue();
const status = builder.getRange("B5").getValue();
const notes = builder.getRange("F5").getValue();

// --------------------------------
// READ HAMPER COSTING
// --------------------------------

const totalCP = builder.getRange("I26").getValue();
const baseSP = builder.getRange("I27").getValue();
const discount = builder.getRange("I28").getValue();
const afterDiscountSP = builder.getRange("I29").getValue();
const variance = builder.getRange("I33").getValue();
const finalSP = builder.getRange("I34").getValue();
const finalMargin = builder.getRange("I35").getValue();

// --------------------------------
// BASIC CHECKS
// --------------------------------

if (!hamperCode) {
ui.alert("No Hamper Code found in the Builder.");
return;
}

if (!hamperName) {
ui.alert("Please enter a Hamper Name.");
return;
}

if (!finalSP) {
ui.alert("Please enter the Final Catalogue SP.");
return;
}

// --------------------------------
// CHECK THAT HAMPER ALREADY EXISTS
// --------------------------------

const summaryLastRow = summary.getLastRow();

if (summaryLastRow < 2) {
ui.alert(
"No saved hampers were found. Use SAVE HAMPER instead."
);
return;
}

const summaryCodes = summary
.getRange(2, 1, summaryLastRow - 1, 1)
.getValues()
.flat();

const hamperExists = summaryCodes.some(function(code) {
return String(code).trim() === String(hamperCode).trim();
});

if (!hamperExists) {

    ui.alert(
      "Hamper " + hamperCode +
      " does not exist yet. Use SAVE HAMPER instead."
    );

    return;

}

// --------------------------------
// READ CURRENT PRODUCTS FROM BUILDER
// --------------------------------

const products = builder.getRange("A9:J23").getValues();

const rowsToSave = [];

let numberOfItems = 0;

const updatedDate = new Date();

products.forEach(function(row) {

    const category = row[0];
    const product = row[1];
    const productCode = row[2];
    const qty = row[3];
    const source = row[4];
    const unitCP = row[5];
    const productTotalCP = row[6];
    const targetMargin = row[7];
    const unitSP = row[8];
    const productTotalSP = row[9];

    if (product) {

      rowsToSave.push([
        hamperCode,
        hamperName,
        collection,
        status,
        productCode,
        category,
        product,
        qty,
        source,
        unitCP,
        productTotalCP,
        targetMargin,
        unitSP,
        productTotalSP,
        updatedDate
      ]);

      // Inside Packaging contributes to cost
      // but NOT to No. of Items
      if (categoryCountsAsItem(category)) {

numberOfItems += Number(qty) || 0;
}
}

});

if (rowsToSave.length === 0) {

    ui.alert(
      "There are no products in this hamper."
    );

    return;

}

// --------------------------------
// CONFIRM BEFORE REPLACING DATA
// --------------------------------

const response = ui.alert(
"Update " + hamperCode,
"This will replace the saved version of " +
hamperCode +
" with the current Hamper Builder. Continue?",
ui.ButtonSet.YES_NO
);

if (response !== ui.Button.YES) {
return;
}

// --------------------------------
// DELETE OLD PRODUCT ROWS
// --------------------------------

for (let row = details.getLastRow(); row >= 2; row--) {

    const existingCode =
      details.getRange(row, 1).getValue();

    if (
      String(existingCode).trim() ===
      String(hamperCode).trim()
    ) {

      details.deleteRow(row);

    }

}

// --------------------------------
// SAVE UPDATED PRODUCT ROWS
// --------------------------------

const startRow = details.getLastRow() + 1;

details
.getRange(
startRow,
1,
rowsToSave.length,
15
)
.setValues(rowsToSave);

// --------------------------------
// CALCULATE FINAL PROFIT
// --------------------------------

const grossProfit = finalSP - totalCP;

// --------------------------------
// UPDATE HAMPER SUMMARY
// --------------------------------

const newSummaryRow = [
hamperCode, // A
hamperName, // B
collection, // C
status, // D
numberOfItems, // E
totalCP, // F
baseSP, // G
discount, // H
afterDiscountSP, // I
targetSP, // J
variance, // K
finalSP, // L
grossProfit, // M
finalMargin, // N
notes, // O
updatedDate // P
];

for (let row = 2; row <= summary.getLastRow(); row++) {

    const existingCode =
      summary.getRange(row, 1).getValue();

    if (
      String(existingCode).trim() ===
      String(hamperCode).trim()
    ) {

      summary
        .getRange(row, 1, 1, 16)
        .setValues([newSummaryRow]);

      break;
    }

}

// --------------------------------
// FINISHED
// --------------------------------

ss.toast(
hamperCode + " updated successfully.",
"Update Hamper",
4
);

}

function duplicateHamper() {

const ss = SpreadsheetApp.getActiveSpreadsheet();
const builder = ss.getSheetByName("Hamper Builder");
const summary = ss.getSheetByName("Hamper Summary");
const ui = SpreadsheetApp.getUi();

// --------------------------------
// CHECK THAT A HAMPER IS LOADED
// --------------------------------

const currentCode = builder.getRange("B3").getValue();

if (!currentCode) {
ui.alert(
"Please LOAD a hamper before using DUPLICATE HAMPER."
);
return;
}

// --------------------------------
// CHECK THAT THE HAMPER EXISTS
// --------------------------------

const lastRow = summary.getLastRow();

if (lastRow < 2) {
ui.alert("No saved hampers were found.");
return;
}

const savedCodes = summary
.getRange(2, 1, lastRow - 1, 1)
.getValues()
.flat();

const hamperExists = savedCodes.some(function(code) {
return String(code).trim() === String(currentCode).trim();
});

if (!hamperExists) {
ui.alert(
currentCode +
" is not a saved hamper. Please LOAD a saved hamper first."
);
return;
}

// --------------------------------
// CONFIRM DUPLICATION
// --------------------------------

const response = ui.alert(
"Duplicate " + currentCode,
"Create a new hamper using " +
currentCode +
" as the starting point?",
ui.ButtonSet.YES_NO
);

if (response !== ui.Button.YES) {
return;
}

// --------------------------------
// GENERATE NEXT HAMPER CODE
// --------------------------------

const newCode = getNextHamperCode();

// --------------------------------
// CHANGE BUILDER TO NEW HAMPER
// --------------------------------

builder.getRange("B3").setValue(newCode);

// Keep the original name but mark it as a copy
const currentName = builder.getRange("F3").getValue();

if (currentName) {
builder
.getRange("F3")
.setValue(currentName + " - Copy");
}

// New duplicate starts as Draft
builder.getRange("B5").setValue("Draft");

// Clear the Load Hamper dropdown in I5
builder.getRange("I5").clearContent();

// --------------------------------
// FINISHED
// --------------------------------

ss.toast(
currentCode +
" duplicated as " +
newCode +
". Modify it and click SAVE HAMPER.",
"Duplicate Hamper",
6
);

}

function categoryCountsAsItem(category) {

const ss = SpreadsheetApp.getActiveSpreadsheet();
const settings = ss.getSheetByName("Settings");

const lastRow = settings.getLastRow();

if (lastRow < 2) {
return true;
}

const data = settings
.getRange(2, 1, lastRow - 1, 2)
.getValues();

const cleanCategory =
String(category).trim().toLowerCase();

for (let i = 0; i < data.length; i++) {

    const settingsCategory =
      String(data[i][0]).trim().toLowerCase();

    const countAsItem =
      String(data[i][1]).trim().toLowerCase();

    if (settingsCategory === cleanCategory) {
      return countAsItem === "yes";
    }

}

return true;
}

function addToQuote() {

const ss = SpreadsheetApp.getActiveSpreadsheet();

const builder = ss.getSheetByName("Hamper Builder");
const quote = ss.getSheetByName("Quote Builder");

const ui = SpreadsheetApp.getUi();

// --------------------------------
// READ CURRENT HAMPER
// --------------------------------

const hamperCode = builder.getRange("B3").getValue();
const hamperName = builder.getRange("F3").getValue();

// Catalogue Selling Price from Hamper Builder
const cataloguePrice = builder.getRange("I27").getValue();

// --------------------------------
// CHECK REQUIRED INFORMATION
// --------------------------------

if (!hamperCode) {
ui.alert("No Hamper Code found in Hamper Builder.");
return;
}

if (!hamperName) {
ui.alert("No Hamper Name found in Hamper Builder.");
return;
}

if (!cataloguePrice) {
ui.alert("No Catalogue Selling Price found for this hamper.");
return;
}

// --------------------------------
// CHECK IF HAMPER ALREADY ADDED
// --------------------------------

const existingCodes = quote
.getRange("B10:B19")
.getValues()
.flat();

const alreadyExists = existingCodes.some(function(code) {

    return (
      String(code).trim() ===
      String(hamperCode).trim()
    );

});

if (alreadyExists) {

    ui.alert(
      hamperCode +
      " is already added to this quotation."
    );

    return;

}

// --------------------------------
// FIND NEXT EMPTY ROW
// --------------------------------

let targetRow = null;

for (let row = 10; row <= 19; row++) {

    const code =
      quote.getRange(row, 2).getValue();

    if (!code) {
      targetRow = row;
      break;
    }

}

if (!targetRow) {

    ui.alert(
      "The Quote Builder already contains 10 hamper options."
    );

    return;

}

// --------------------------------
// ADD HAMPER TO QUOTE BUILDER
// --------------------------------

// B = Hamper Code
quote
.getRange(targetRow, 2)
.setValue(hamperCode);

// C = Hamper Name
quote
.getRange(targetRow, 3)
.setValue(hamperName);

// E = Catalogue Price
quote
.getRange(targetRow, 5)
.setValue(cataloguePrice);

// F = Discount %
// Leave blank so discount can be decided for this client
quote
.getRange(targetRow, 6)
.clearContent();

// G = Final Rate
// Formula calculates Catalogue Price less Discount
quote
.getRange(targetRow, 7)
.setFormula(
'=IF(E' + targetRow +
'="","",E' + targetRow +
'\*(1-IF(F' + targetRow +
'="",0,F' + targetRow + ')))'
);

// H = Amount
// Qty x Final Rate
quote
.getRange(targetRow, 8)
.setFormula(
'=IF(OR(D' + targetRow +
'="",G' + targetRow +
'=""),"",D' + targetRow +
'\*G' + targetRow + ')'
);

// I = Detail Mode
quote
.getRange(targetRow, 9)
.setValue(
ss.getSheetByName("Settings").getRange("H2").getValue()
);

// J = Packaging Treatment
quote
.getRange(targetRow, 10)
.setValue("Absorb into Box & Packaging");

// --------------------------------
// FINISHED
// --------------------------------

ss.toast(
hamperCode + " added to Quote Builder.",
"Add to Quote",
4
);

}

function removeHamperFromQuote() {

const ss = SpreadsheetApp.getActiveSpreadsheet();
const quote = ss.getSheetByName("Quote Builder");
const ui = SpreadsheetApp.getUi();

// --------------------------------
// READ SELECTED HAMPER
// --------------------------------

const selectedCode = quote.getRange("E7").getValue();

if (!selectedCode) {
ui.alert(
"Please select a Hamper Code in E7 first."
);
return;
}

// --------------------------------
// FIND HAMPER ROW
// --------------------------------

let hamperRow = null;

for (let row = 10; row <= 19; row++) {

    const code = quote.getRange(row, 2).getValue();

    if (
      String(code).trim() ===
      String(selectedCode).trim()
    ) {
      hamperRow = row;
      break;
    }

}

if (!hamperRow) {
ui.alert(
selectedCode + " was not found in this quotation."
);
return;
}

// --------------------------------
// CONFIRM
// --------------------------------

const response = ui.alert(
"Remove " + selectedCode,
"Remove " + selectedCode +
" from the current quotation?",
ui.ButtonSet.YES_NO
);

if (response !== ui.Button.YES) {
return;
}

// --------------------------------
// SHIFT REMAINING HAMPERS UP
// --------------------------------

for (let row = hamperRow; row < 19; row++) {

    // Copy B:J from next row into current row
    const nextValues = quote
      .getRange(row + 1, 2, 1, 9)
      .getValues();

    quote
      .getRange(row, 2, 1, 9)
      .setValues(nextValues);

}

// --------------------------------
// CLEAR LAST ROW
// --------------------------------

quote.getRange("B19:F19").clearContent();

// Restore formulas in G19 and H19
quote
.getRange("G19")
.setFormula(
'=IF(E19="","",E19\*(1-IF(F19="",0,F19)))'
);

quote
.getRange("H19")
.setFormula(
'=IF(OR(D19="",G19=""),"",D19\*G19)'
);

quote.getRange("I19:J19").clearContent();

// Clear hamper selector
quote.getRange("E7").clearContent();

// --------------------------------
// FINISHED
// --------------------------------

ss.toast(
selectedCode + " removed from quotation.",
"Remove Hamper",
4
);

}

function newQuote() {

const ss = SpreadsheetApp.getActiveSpreadsheet();
const quote = ss.getSheetByName("Quote Builder");
const ui = SpreadsheetApp.getUi();

// --------------------------------
// CONFIRM BEFORE CLEARING
// --------------------------------

const response = ui.alert(
"New Quote",
"This will clear the current Quote Builder. Continue?",
ui.ButtonSet.YES_NO
);

if (response !== ui.Button.YES) {
return;
}

// --------------------------------
// CLEAR CLIENT / QUOTE INFORMATION
// --------------------------------

// Document Type
quote.getRange("B3").setValue("Quotation");

// Quote / PI Number
quote.getRange("E3").clearContent();

// Date - restore TODAY formula
quote.getRange("I3").setFormula("=TODAY()");

// Client / Company
quote.getRange("B4").clearContent();

// Contact Person
quote.getRange("E4").clearContent();

// Validity
quote.getRange("I4").setValue("15 Days");

// Email
quote.getRange("B5").clearContent();

// Phone
quote.getRange("E5").clearContent();

// Status
quote.getRange("I5").setValue("Draft");

// Billing Address
quote.getRange("B6").clearContent();

// GSTIN
quote.getRange("E6").clearContent();

// Occasion / Project
quote.getRange("I6").clearContent();

// Quote Structure
quote.getRange("B7").clearContent();

// Select Hamper
quote.getRange("E7").clearContent();

// --------------------------------
// CLEAR HAMPER TABLE
// --------------------------------

for (let row = 10; row <= 19; row++) {

    // B:F
    // Hamper Code, Name, Qty,
    // Catalogue Price and Discount
    quote
      .getRange(row, 2, 1, 5)
      .clearContent();

    // Restore Final Rate formula - Column G
    quote
      .getRange(row, 7)
      .setFormula(
        '=IF(E' + row +
        '="","",E' + row +
        '*(1-IF(F' + row +
        '="",0,F' + row + ')))'
      );

    // Restore Amount formula - Column H
    quote
      .getRange(row, 8)
      .setFormula(
        '=IF(OR(D' + row +
        '="",G' + row +
        '=""),"",D' + row +
        '*G' + row + ')'
      );

    // Clear Detail Mode and Packaging Treatment
    // Dropdown validation remains
    quote
      .getRange(row, 9, 1, 2)
      .clearContent();

}

// --------------------------------
// CLEAR QUOTATION-SPECIFIC NOTES
// --------------------------------

quote.getRange("A23:D26").clearContent();

// --------------------------------
// CLEAR TOTAL VALUES
// --------------------------------

// Clear only manual quotation inputs
quote.getRange("H23:H25").clearContent();
quote.getRange("H27").clearContent();
// --------------------------------
// RESTORE QUOTATION SUMMARY FORMULAS
// --------------------------------

// H22 = Combined Subtotal
quote.getRange("H22").setFormula(
'=IF(B7="Combined Order",SUM(H10:H19),"")'
);

// H26 = Taxable Value
quote.getRange("H26").setFormula(
'=IF(B7="Combined Order",H22-H23+H24+H25,"")'
);

// H28 = GST Amount
quote.getRange("H28").setFormula(
'=IF(B7="Combined Order",H26\*H27,"")'
);

// H29 = Grand Total
quote.getRange("H29").setFormula(
'=IF(B7="Combined Order",H26+H28,"")'
);

// Default GST
quote.getRange("H27").setValue(0.18);

// --------------------------------
// FINISHED
// --------------------------------

ss.toast(
"Quote Builder cleared and ready for a new quotation.",
"New Quote",
4
);

}

function saveQuote() {

const ss = SpreadsheetApp.getActiveSpreadsheet();

const quote = ss.getSheetByName("Quote Builder");
const register = ss.getSheetByName("Quotation Register");
const details = ss.getSheetByName("Quote Details");

const ui = SpreadsheetApp.getUi();

// --------------------------------
// READ QUOTE BUILDER
// --------------------------------

const documentType = quote.getRange("B3").getValue();
const documentDate = quote.getRange("I3").getValue();

const clientName = quote.getRange("B4").getValue();
const contactPerson = quote.getRange("E4").getValue();

const email = quote.getRange("B5").getValue();
const phone = quote.getRange("E5").getValue();

const billingAddress = quote.getRange("B6").getValue();
const gstin = quote.getRange("E6").getValue();

const quoteStructure = quote.getRange("B7").getValue();

const validity = quote.getRange("I4").getValue();
const status = quote.getRange("I5").getValue();

const occasion = quote.getRange("I6").getValue();

// --------------------------------
// BASIC CHECKS
// --------------------------------

if (!documentType) {
ui.alert("Please select Document Type.");
return;
}

if (!clientName) {
ui.alert("Please enter Client / Company.");
return;
}

if (!quoteStructure) {
ui.alert("Please select Quote Structure.");
return;
}

// --------------------------------
// CHECK IF ALREADY SAVED
// --------------------------------

const existingDocumentNo =
quote.getRange("E3").getValue();

if (existingDocumentNo) {

    ui.alert(
      existingDocumentNo +
      " is already saved.\n\n" +
      "Use UPDATE QUOTE when we build that function."
    );

    return;

}

// --------------------------------
// READ HAMPER TABLE
// --------------------------------

const hamperRows =
quote.getRange("A10:J19").getValues();

const savedHamperRows = [];

let numberOfHampers = 0;
let totalQty = 0;

hamperRows.forEach(function(row) {

    const option = row[0];
    const hamperCode = row[1];
    const hamperName = row[2];
    const qty = row[3];
    const cataloguePrice = row[4];
    const discount = row[5];
    const finalRate = row[6];
    const amount = row[7];
    const detailMode = row[8];
    const packagingTreatment = row[9];

    if (hamperCode) {

      numberOfHampers++;

      totalQty += Number(qty) || 0;

      savedHamperRows.push([
        "",
        option,
        hamperCode,
        hamperName,
        qty,
        cataloguePrice,
        discount,
        finalRate,
        amount,
        detailMode,
        packagingTreatment
      ]);

    }

});

if (savedHamperRows.length === 0) {

    ui.alert(
      "There are no hampers in this quotation."
    );

    return;

}

// --------------------------------
// GENERATE DOCUMENT NUMBER
// --------------------------------

const typeText =
String(documentType)
.trim()
.toLowerCase();

const prefix =
typeText === "proforma invoice"
? "LLPI-"
: "LLQT-";

const lastRegisterRow =
register.getLastRow();

let highestNumber = 0;

if (lastRegisterRow >= 2) {

    const existingNumbers =
      register
        .getRange(
          2,
          1,
          lastRegisterRow - 1,
          1
        )
        .getValues()
        .flat();

    existingNumbers.forEach(function(value) {

      const text =
        String(value).trim();

      if (text.indexOf(prefix) === 0) {

        const numberPart =
          Number(
            text.substring(prefix.length)
          );

        if (!isNaN(numberPart)) {

          highestNumber =
            Math.max(
              highestNumber,
              numberPart
            );

        }

      }

    });

}

const documentNo =
prefix +
String(highestNumber + 1)
.padStart(3, "0");

// --------------------------------
// READ TOTALS
// --------------------------------

const combinedSubtotal =
quote.getRange("H22").getValue();

const gstAmount =
quote.getRange("H28").getValue();

const grandTotal =
quote.getRange("H29").getValue();

// --------------------------------
// QUOTED VALUE
// --------------------------------

let quotedValue = "";

if (quoteStructure === "Combined Order") {

quotedValue =
quote.getRange("H26").getValue() ||
combinedSubtotal ||
"";

}

// --------------------------------
// SAVE TO QUOTATION REGISTER
// --------------------------------

const registerRow = [

    documentNo,          // A Document No.
    documentType,        // B Document Type
    documentDate,        // C Date
    clientName,          // D Client / Company
    contactPerson,       // E Contact Person
    phone,               // F Phone
    email,               // G Email
    occasion,            // H Occasion / Project
    quoteStructure,      // I Quote Structure
    numberOfHampers,     // J No. of Hampers
    totalQty,            // K Total Qty
    quotedValue,         // L Quoted Value
    gstAmount,           // M GST
    grandTotal,          // N Grand Total
    status,              // O Status
    validity,            // P Validity
    "",                  // Q Follow-up Date
    quote.getRange("A23").getValue(), // R Notes
    new Date(),          // S Last Updated
    ""                    // T Linked Document No.

];

register
.getRange(
register.getLastRow() + 1,
1,
1,
20
)
.setValues([registerRow]);

// --------------------------------
// ADD DOCUMENT NUMBER TO DETAILS
// --------------------------------

savedHamperRows.forEach(function(row) {

    row[0] = documentNo;

});

// --------------------------------
// SAVE HAMPER DETAILS
// --------------------------------

details
.getRange(
details.getLastRow() + 1,
1,
savedHamperRows.length,
11
)
.setValues(savedHamperRows);

// --------------------------------
// PUT DOCUMENT NUMBER INTO BUILDER
// --------------------------------

quote
.getRange("E3")
.setValue(documentNo);

// --------------------------------
// FINISHED
// --------------------------------

ss.toast(
documentNo +
" saved successfully.",
"Save Quote",
5
);

}

function refreshHamperPrices() {

const ss = SpreadsheetApp.getActiveSpreadsheet();

const master = ss.getSheetByName("Product Master");
const details = ss.getSheetByName("Hamper Details");
const summary = ss.getSheetByName("Hamper Summary");

const ui = SpreadsheetApp.getUi();

// --------------------------------
// CONFIRM
// --------------------------------

const response = ui.alert(
"Refresh Hamper Prices",
"This will update saved hampers using the latest Product Master prices.\n\nQuotation Register and Quote Details will NOT be changed.\n\nContinue?",
ui.ButtonSet.YES_NO
);

if (response !== ui.Button.YES) {
return;
}

// --------------------------------
// READ PRODUCT MASTER
// --------------------------------

const masterLastRow = master.getLastRow();

if (masterLastRow < 2) {
ui.alert("No products found in Product Master.");
return;
}

const masterData = master
.getRange(2, 1, masterLastRow - 1, 8)
.getValues();

const productMap = {};

masterData.forEach(function(row) {

    const productCode = String(row[0]).trim();

    if (!productCode) {
      return;
    }

    productMap[productCode] = {
      category: row[1],
      product: row[2],
      source: row[3],
      cp: Number(row[4]) || 0,
      margin: Number(row[5]) || 0,
      sp: Number(row[6]) || 0
    };

});

// --------------------------------
// READ HAMPER DETAILS
// --------------------------------

const detailsLastRow = details.getLastRow();

if (detailsLastRow < 2) {
ui.alert("No saved Hamper Details found.");
return;
}

const detailData = details
.getRange(2, 1, detailsLastRow - 1, 15)
.getValues();

// --------------------------------
// TRACK AFFECTED HAMPERS
// --------------------------------

const affectedHampers = {};

let updatedRows = 0;
let missingProducts = [];

// --------------------------------
// UPDATE ONLY CHANGED PRODUCT ROWS
// --------------------------------

detailData.forEach(function(row, index) {

    const hamperCode = String(row[0]).trim();
    const productCode = String(row[4]).trim();

    if (!hamperCode || !productCode) {
      return;
    }

    const product = productMap[productCode];

    if (!product) {

      missingProducts.push(
        hamperCode + " → " + productCode
      );

      return;
    }


    const oldCP = Number(row[9]) || 0;
    const oldSP = Number(row[12]) || 0;

    const newCP = product.cp;
    const newSP = product.sp;

    // Only update if something actually changed
    if (
      oldCP !== newCP ||
      oldSP !== newSP ||
      row[5] !== product.category ||
      row[6] !== product.product ||
      row[8] !== product.source ||
      Number(row[11]) !== product.margin
    ) {

      const qty = Number(row[7]) || 0;

      // F = Category
      row[5] = product.category;

      // G = Product
      row[6] = product.product;

      // I = Source
      row[8] = product.source;

      // J = Unit CP
      row[9] = newCP;

      // K = Total CP
      row[10] = qty * newCP;

      // L = Target Margin %
      row[11] = product.margin;

      // M = Unit SP
      row[12] = newSP;

      // N = Total SP
      row[13] = qty * newSP;

      updatedRows++;

      affectedHampers[hamperCode] = true;

    }

});

// --------------------------------
// WRITE HAMPER DETAILS
// --------------------------------
//
// We write the existing rows back once.
// No quotation sheets are touched.

details
.getRange(
2,
1,
detailData.length,
15
)
.setValues(detailData);

// --------------------------------
// IF NOTHING CHANGED
// --------------------------------

const affectedCodes =
Object.keys(affectedHampers);

if (affectedCodes.length === 0) {

    let message =
      "No hamper prices needed updating.";

    if (missingProducts.length > 0) {

      message +=
        "\n\nProducts not found in Product Master: " +
        missingProducts.length;

    }

    ss.toast(
      message,
      "Refresh Hamper Prices",
      5
    );

    return;

}

// --------------------------------
// READ HAMPER SUMMARY
// --------------------------------

const summaryLastRow = summary.getLastRow();

if (summaryLastRow < 2) {

    ui.alert(
      "Hamper Details were updated, but Hamper Summary has no saved hampers."
    );

    return;

}

const summaryData = summary
.getRange(
2,
1,
summaryLastRow - 1,
16
)
.getValues();

// --------------------------------
// CALCULATE NEW TOTALS
// ONLY FOR AFFECTED HAMPERS
// --------------------------------

const hamperTotals = {};

detailData.forEach(function(row) {

    const hamperCode = String(row[0]).trim();

    if (!affectedHampers[hamperCode]) {
      return;
    }

    const qty = Number(row[7]) || 0;

    const totalCP = Number(row[10]) || 0;
    const totalSP = Number(row[13]) || 0;

    if (!hamperTotals[hamperCode]) {

      hamperTotals[hamperCode] = {
        totalCP: 0,
        baseSP: 0
      };

    }

    hamperTotals[hamperCode].totalCP += totalCP;
    hamperTotals[hamperCode].baseSP += totalSP;

});

// --------------------------------
// UPDATE ONLY AFFECTED SUMMARY ROWS
// --------------------------------

summaryData.forEach(function(row) {

    const hamperCode = String(row[0]).trim();

    if (!affectedHampers[hamperCode]) {
      return;
    }

    const totals = hamperTotals[hamperCode];

    if (!totals) {
      return;
    }


    const totalCP = totals.totalCP;
    const baseSP = totals.baseSP;

    // H = Discount %
    const discount =
      Number(row[7]) || 0;

    // L = Final Catalogue SP
    // IMPORTANT: preserve this manually approved price
    const finalCatalogueSP =
      Number(row[11]) || 0;


    // I = SP After Discount
    const spAfterDiscount =
      baseSP * (1 - discount);


    // M = Gross Profit
    const grossProfit =
      finalCatalogueSP - totalCP;


    // N = Final Margin %
    let finalMargin = "";

    if (finalCatalogueSP !== 0) {

      finalMargin =
        grossProfit / finalCatalogueSP;

    }


    // F = Total Hamper CP
    row[5] = totalCP;

    // G = Base Selling Price
    row[6] = baseSP;

    // I = SP After Discount
    row[8] = spAfterDiscount;

    // J = Target SP
    // PRESERVED

    // K = Variance to Target
    // PRESERVED

    // L = Final Catalogue SP
    // PRESERVED

    // M = Gross Profit
    row[12] = grossProfit;

    // N = Final Margin %
    row[13] = finalMargin;

    // O = Notes
    // PRESERVED

    // P = Date Saved / Updated
    row[15] = new Date();

});

// --------------------------------
// WRITE SUMMARY ONCE
// --------------------------------

summary
.getRange(
2,
1,
summaryData.length,
16
)
.setValues(summaryData);

// --------------------------------
// FINISHED
// --------------------------------

SpreadsheetApp.flush();

let message =
"Refresh completed.\n\n" +
"Hamper Details updated: " +
updatedRows +
" product row(s).\n" +
"Hampers recalculated: " +
affectedCodes.length;

if (missingProducts.length > 0) {

    message +=
      "\n\nProducts not found in Product Master: " +
      missingProducts.length;

}

ss.toast(
message,
"Refresh Hamper Prices",
6
);

}
