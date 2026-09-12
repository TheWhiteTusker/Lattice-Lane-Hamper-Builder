/**
 * Lattice Lane Standard Product Code Architecture & Format:
 * Format: [CATEGORY_CODE]/[SERIAL_NUMBER]/[COLOR_CODE]
 * Example: LC/0001/WL (Lights & Candles, Item 0001, Walnut)
 *
 * Each product comes in strictly 3 colors:
 * - Walnut  -> WL
 * - Natural -> NT
 * - Black   -> BL
 */

export const STANDARD_PRODUCT_COLORS = [
  { name: "Walnut", code: "WL", hex: "#5c4033" },
  { name: "Natural", code: "NT", hex: "#e4cdad" },
  { name: "Black", code: "BL", hex: "#222222" },
] as const;

export type StandardColorName = (typeof STANDARD_PRODUCT_COLORS)[number]["name"];
export type StandardColorCode = (typeof STANDARD_PRODUCT_COLORS)[number]["code"];

export const COLOR_TO_CODE: Record<string, StandardColorCode> = {
  walnut: "WL",
  natural: "NT",
  black: "BL",
  wl: "WL",
  nt: "NT",
  bl: "BL",
  "walnut finish": "WL",
  "natural finish": "NT",
  "black finish": "BL",
};

export const CODE_TO_COLOR: Record<StandardColorCode, StandardColorName> = {
  WL: "Walnut",
  NT: "Natural",
  BL: "Black",
};

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

  const normalizedColKey = (colorCodeOrName || "").trim().toLowerCase();
  const colCode =
    COLOR_TO_CODE[normalizedColKey] ||
    (colorCodeOrName.toUpperCase().slice(0, 2) as StandardColorCode) ||
    "WL";

  return `${cat}/${serialStr}/${colCode}`;
}

/**
 * Parse a product code into categoryCode, serial, colorCode, and validity.
 * Valid strictly matches: [A-Z0-9]{2,}\/\d{4}\/(WL|NT|BL)
 */
export function parseProductCode(code: string): {
  categoryCode: string;
  serial: string;
  colorCode: string;
  colorName: string;
  isValid: boolean;
} {
  const clean = (code || "").trim().toUpperCase();
  const strictMatch = clean.match(/^([A-Z0-9]+)\/(\d{4})\/(WL|NT|BL)$/);

  if (strictMatch) {
    const colCode = strictMatch[3] as StandardColorCode;
    return {
      categoryCode: strictMatch[1],
      serial: strictMatch[2],
      colorCode: colCode,
      colorName: CODE_TO_COLOR[colCode] || colCode,
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
 * Derive 2-letter uppercase category code from category name.
 * e.g. "Lights & Candles" -> "LC", "Box & Packaging" -> "BP", "Decor" -> "DC"
 */
export function deriveCategoryCode(name: string): string {
  if (!name) return "XX";
  const words = name
    .trim()
    .replace(/[&/\\#,+()$~%.'":*?<>{}]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  const clean = words[0].replace(/[^A-Za-z0-9]/g, "");
  return clean.slice(0, 2).toUpperCase().padEnd(2, "X");
}
