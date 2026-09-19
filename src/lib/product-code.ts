/**
 * Lattice Lane Standard Product Code Architecture & Format:
 * Format: [CATEGORY_CODE]/[SERIAL_NUMBER]/[COLOR_CODE]
 * Example: LC/0001/WL (Lights & Candles, Item 0001, Walnut)
 *
 * Standard colors: Walnut -> WL, Natural -> NT, Black -> BL. Colors added in
 * Settings get a derived two-letter code (see colorCode).
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

const STANDARD_CODES: readonly string[] = STANDARD_PRODUCT_COLORS.map((c) => c.code);

/**
 * Two-letter code for any colour: the standard three keep WL/NT/BL, anything
 * added in Settings gets its initials ("Dark Oak" -> DO, "Teak" -> TE). A
 * clash with a standard code falls back to first + last letter ("Blue" -> BE).
 */
export function colorCode(name: string): string {
  const key = (name || "").trim().toLowerCase();
  if (COLOR_TO_CODE[key]) return COLOR_TO_CODE[key];
  const code = deriveCategoryCode(name);
  if (!STANDARD_CODES.includes(code)) return code;
  const letters = key.replace(/[^a-z0-9]/g, "");
  return (letters[0] + letters[letters.length - 1]).toUpperCase();
}

export type ProductColor = { name: string; code: string; hex: string };

/** Swatch for a colour that has no picked hex yet. */
export const FALLBACK_COLOR_HEX = "#94a3b8";

/**
 * Colours from Settings with code and swatch. The hex picked in the Master
 * wins, then the standard swatch, then neutral grey.
 */
export function resolveColors(
  names: string[],
  hexByName: Record<string, string> = {},
): ProductColor[] {
  return names.map((name) => ({
    name,
    code: colorCode(name),
    hex:
      hexByName[name] ??
      STANDARD_PRODUCT_COLORS.find((c) => c.name.toLowerCase() === name.toLowerCase())?.hex ??
      FALLBACK_COLOR_HEX,
  }));
}

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
