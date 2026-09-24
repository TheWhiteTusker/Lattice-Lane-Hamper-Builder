/**
 * Lattice Lane Standard Product Code Architecture & Format:
 * Format: [CATEGORY_CODE]/[SERIAL_NUMBER]/[COLOR_CODE]
 * Example: LC/0001/WL (Lights & Candles, Item 0001, Walnut)
 *
 * Standard colors: Walnut -> WL, Natural -> NT, Black -> BL. Colors added in
 * Settings get a derived two-letter code (see colorCode).
 */

import {
  CODE_TO_COLOR,
  COLOR_TO_CODE,
  colorCode,
  type StandardColorCode,
} from "./product-colors.ts";

export * from "./product-colors.ts";

/**
 * Format a standard product code: CATEGORY/SERIAL/COLOR (e.g. LC/0001/WL)
 */
export function formatProductCode(
  categoryCode: string,
  serial: number | string,
  colorCodeOrName: string,
): string {
  const cat = (categoryCode || "XX").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const rawNum =
    typeof serial === "number"
      ? serial
      : parseInt(String(serial).replace(/\D/g, ""), 10) || 1;
  const serialStr = String(Math.max(1, rawNum)).padStart(4, "0");

  const colCode = colorCodeOrName?.trim() ? colorCode(colorCodeOrName) : "WL";

  return `${cat}/${serialStr}/${colCode}`;
}

/**
 * Parse a product code into categoryCode, serial, colorCode, and validity.
 * Valid strictly matches: [A-Z0-9]{2,}\/\d{4}\/[A-Z0-9]{2}
 */
export function parseProductCode(code: string): {
  categoryCode: string;
  serial: string;
  colorCode: string;
  colorName: string;
  isValid: boolean;
} {
  const clean = (code || "").trim().toUpperCase();
  const strictMatch = clean.match(/^([A-Z0-9]+)\/(\d{4})\/([A-Z0-9]{2})$/);

  if (strictMatch) {
    const colCode = strictMatch[3];
    return {
      categoryCode: strictMatch[1],
      serial: strictMatch[2],
      colorCode: colCode,
      colorName: (CODE_TO_COLOR as Record<string, string>)[colCode] || colCode,
      isValid: true,
    };
  }

  // Flexible slash match: CATEGORY/SERIAL/COLOR
  const relaxedSlash = clean.match(/^([A-Z0-9]+)\/(\d+)\/([A-Z0-9]+)$/);
  if (relaxedSlash) {
    const colKey = relaxedSlash[3].toLowerCase();
    const colCode =
      COLOR_TO_CODE[colKey] || (relaxedSlash[3].slice(0, 2) as StandardColorCode);
    return {
      categoryCode: relaxedSlash[1],
      serial: relaxedSlash[2].padStart(4, "0"),
      colorCode: colCode,
      colorName: (CODE_TO_COLOR as Record<string, string>)[colCode] || colCode,
      isValid: false,
    };
  }

  // Legacy format like LC001 or LC010
  const legacyMatch = clean.match(/^([A-Z]+)(\d+)$/);
  if (legacyMatch) {
    return {
      categoryCode: legacyMatch[1],
      serial: legacyMatch[2].padStart(4, "0"),
      colorCode: "WL",
      colorName: "Walnut",
      isValid: false,
    };
  }

  return {
    categoryCode: "",
    serial: "0001",
    colorCode: "WL",
    colorName: "Walnut",
    isValid: false,
  };
}

/**
 * Given a list of existing product codes, find the highest serial for this category and return next 4-digit serial.
 */
export function getNextSerialForCategory(
  categoryCode: string,
  existingCodes: string[],
): string {
  const cat = (categoryCode || "").trim().toUpperCase();
  if (!cat) return "0001";

  let maxSerial = 0;
  for (const raw of existingCodes) {
    if (!raw) continue;
    const parsed = parseProductCode(raw);
    if (parsed.categoryCode === cat) {
      const num = parseInt(parsed.serial, 10);
      if (Number.isFinite(num) && num > maxSerial) {
        maxSerial = num;
      }
    }
  }

  return String(maxSerial + 1).padStart(4, "0");
}

/**
 * One code per selected colour, sharing category and serial:
 * "LC/0001/WL" + [Walnut, Black] -> LC/0001/WL, LC/0001/BL.
 */
export function codesForColors(
  code: string,
  colors: string[],
): { color: string; code: string }[] {
  const { categoryCode, serial } = parseProductCode(code);
  return colors.map((color) => ({
    color,
    code: categoryCode
      ? formatProductCode(categoryCode, serial, color)
      : `${code.trim().toUpperCase()}/${colorCode(color)}`,
  }));
}
