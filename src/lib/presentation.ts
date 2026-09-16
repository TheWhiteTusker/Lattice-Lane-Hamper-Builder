import type { Fill, HamperCanvas, Layer } from "./hamper-canvas.ts";

/*
 * Presentation decks in the house format ("Premium Gift Hamper Deck 2026"):
 * a green entry slide, one white slide per hamper or product with the photos
 * standing on a green band, and a green thank-you slide. Every slide is an
 * ordinary designer canvas, so the photo editor edits them afterwards.
 *
 * The layout needs each photo's real proportions, so slides are generated in
 * the browser once the images have loaded (see presentations/build-slides.ts).
 */

export const SLIDE = { width: 1920, height: 1080 } as const;

export const DECK_COLORS = {
  green: "#b5c2b1", // the house deck's dusty pink, in Lattice Lane sage
  heading: "#595959",
  ink: "#1f1f1f",
  muted: "#7f7f7f",
  page: "#ffffff",
} as const;

export const DEFAULT_NOTE =
  "Pricing is applicable for an MOQ of 100 units. Estimated delivery: 15 working days from design approval and advance payment confirmation.";

export type Size = { width: number; height: number };
export type Photo = { url: string; size: Size };

export type DeckItemInfo = {
  product_id: string | null;
  name: string;
  /** Small line under the name, e.g. the product's category. */
  caption: string;
  image_url: string | null;
};

export type HamperInfo = {
  id: string;
  code: string;
  name: string;
  price: number | null;
  /** The hamper's own designed picture, used when no product has a photo. */
  image_url: string | null;
  items: DeckItemInfo[];
};

export type ProductInfo = {
  id: string;
  code: string;
  name: string;
  caption: string;
  price: number | null;
  image_url: string | null;
};

/** Looks up a loaded photo's natural size; undefined if it didn't load. */
export type SizeOf = (url: string) => Size | undefined;

let seq = 0;
const nextId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

const base = (x: number, y: number) => ({
  id: nextId(),
  visible: true,
  locked: false,
  x,
  y,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
});

const solid = (color: string): Fill => ({ type: "solid", color });

type TextOpts = {
  size: number;
  color: string;
  width: number;
  font?: string;
  style?: "normal" | "bold" | "italic" | "italic bold";
  align?: "left" | "center" | "right";
  spacing?: number;
  lineHeight?: number;
  underline?: boolean;
  name?: string;
};

const text = (value: string, x: number, y: number, o: TextOpts): Layer => ({
  ...base(x, y),
  kind: "text",
  name: o.name,
  text: value,
  fontFamily: o.font ?? "Arial",
  fontSize: o.size,
  fontStyle: o.style ?? "normal",
  align: o.align ?? "left",
  width: o.width,
  letterSpacing: o.spacing ?? 0,
  lineHeight: o.lineHeight ?? 1.15,
  textDecoration: o.underline ? "underline" : "none",
  fill: solid(o.color),
});

const rect = (x: number, y: number, width: number, height: number, color: string, name: string): Layer => ({
  ...base(x, y),
  kind: "rect",
  name,
  width,
  height,
  cornerRadius: 0,
  fill: solid(color),
  stroke: DECK_COLORS.ink,
  strokeWidth: 0,
});

const photo = (url: string, box: { x: number; y: number; width: number; height: number }, productId: string | null, name: string): Layer => ({
  ...base(box.x, box.y),
  kind: "image",
  name,
  product_id: productId,
  url,
  width: box.width,
  height: box.height,
  fit: "stretch",
});

const page = (background: string, layers: Layer[]): HamperCanvas => ({
  width: SLIDE.width,
  height: SLIDE.height,
  background: { fill: solid(background), image_url: null },
  layers,
});

/** "Essential Hamper" -> ["Essential", "Hamper"], as the deck sets its titles. */
export function splitTitle(name: string, fallbackSubtitle: string): [string, string] {
  const m = name.trim().match(/^(.*\S)\s+(hampers?)$/i);
  return m ? [m[1], m[2][0].toUpperCase() + m[2].slice(1)] : [name.trim(), fallbackSubtitle];
}

export const formatInr = (v: number) => `INR ${Math.round(v).toLocaleString("en-IN")}`;

/* ------------------------------------------------------------ entry/closing */

export function coverSlide(title: string, subtitle: string, logo: Photo | null): HamperCanvas {
  const layers: Layer[] = [
    text(title || "Premium", 61, 64, { size: 88, color: DECK_COLORS.heading, width: 1400, name: "Title" }),
    text(subtitle, 61, 164, { size: 38, color: DECK_COLORS.heading, width: 1400, name: "Subtitle" }),
  ];
  if (logo) layers.push(logoLayer(logo, 300, "bottom-right"));
  return page(DECK_COLORS.green, layers);
}

/** The Lattice Lane logo, `width` px wide, tucked into a corner of the slide. */
function logoLayer(logo: Photo, width: number, corner: "bottom-right" | "bottom-left" | "top-right"): Layer {
  const height = (width * logo.size.height) / logo.size.width;
  const x = corner === "bottom-left" ? 86 : 1860 - width;
  const y = corner === "top-right" ? 60 : 1010 - height;
  return photo(logo.url, { x, y, width, height }, null, "Logo");
}

export function closingSlide(heading: string, tagline: string, contact: string, logo: Photo | null): HamperCanvas {
  return page(DECK_COLORS.green, [
    ...(logo ? [logoLayer(logo, 300, "top-right")] : []),
    text(heading || "Thank You", 99, 700, { font: "Questrial", size: 112, color: "#111111", width: 900, name: "Thank you" }),
    text(tagline, 104, 826, { font: "Questrial", size: 48, color: "#111111", width: 900, spacing: 4, name: "Tagline" }),
    text("For any Query", 1022, 690, {
      font: "Questrial",
      size: 38,
      color: "#111111",
      width: 800,
      align: "right",
      underline: true,
      name: "Query heading",
    }),
    text(contact, 822, 752, {
      font: "Questrial",
      size: 34,
      color: "#111111",
      width: 1000,
      align: "right",
      spacing: 3,
      lineHeight: 1.3,
      name: "Contact",
    }),
  ]);
}

/* ---------------------------------------------------------- item slides */

const BAND = { x: 82, y: 529, width: 1746, height: 371 };
const BASELINE = 775; // where photos stand, inside the band
const ROW_WIDTH = 1500;
const LABEL_WIDTH = 320;
const NAME_SIZE = 22;
const CAPTION_SIZE = 15;
const LABEL_HEIGHT = NAME_SIZE * 1.15 + CAPTION_SIZE * 1.15;

type Placed = { item: DeckItemInfo; url: string; x: number; y: number; width: number; height: number; isBox: boolean };

const isBox = (item: DeckItemInfo) => /\bbox/i.test(`${item.caption} ${item.name}`);

/** Scale a photo to a target height, capping its width so wide items don't dominate. */
function fitPhoto(size: Size, targetHeight: number, maxWidth: number) {
  let height = targetHeight;
  let width = (size.width / size.height) * height;
  if (width > maxWidth) {
    width = maxWidth;
    height = (size.height / size.width) * width;
  }
  return { width, height };
}

/**
 * Lays photos out in a row standing on the band: the gift box in the middle
 * and larger, overlapping its neighbours; everything else to either side.
 */
export function arrangeRow(items: { item: DeckItemInfo; url: string; size: Size }[]): Placed[] {
  if (!items.length) return [];
  const boxIndex = items.findIndex((i) => isBox(i.item));
  const box = boxIndex >= 0 ? items[boxIndex] : null;
  const others = items.filter((_, i) => i !== boxIndex);
  const half = Math.ceil(others.length / 2);
  const ordered = box ? [...others.slice(0, half), box, ...others.slice(half)] : others;

  const sized = ordered.map((i) => {
    const boxy = i === box;
    return { ...i, isBox: boxy, ...fitPhoto(i.size, boxy ? 460 : 360, boxy ? 560 : 300) };
  });

  // Neighbours of the box tuck in front of it; other items get a small gap.
  const gaps = sized.slice(1).map((s, i) => {
    const prev = sized[i];
    return prev.isBox || s.isBox ? -0.14 * Math.min(prev.width, s.width) : 28;
  });
  const total = sized.reduce((sum, s) => sum + s.width, 0) + gaps.reduce((sum, g) => sum + g, 0);
  const k = Math.min(1, ROW_WIDTH / total);

  let x = SLIDE.width / 2 - (total * k) / 2;
  return sized.map((s, i) => {
    const width = s.width * k;
    const height = s.height * k;
    const placed = { item: s.item, url: s.url, isBox: s.isBox, x, y: BASELINE - height, width, height };
    x += width + (gaps[i] ?? 0) * k;
    return placed;
  });
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Name + caption beside each photo: left of items on the left, right of the rest, lifted clear of a taller neighbour. */
function labels(row: Placed[]): Layer[] {
  const boxAt = row.findIndex((p) => p.isBox);
  const pivot = boxAt >= 0 ? boxAt : Math.floor(row.length / 2);

  return row.flatMap((p, i) => {
    const leftSide = i < pivot;
    const box = {
      x: leftSide ? p.x - 10 - LABEL_WIDTH : p.x + p.width + 10,
      y: p.y + (p.isBox ? 6 : 16),
      width: LABEL_WIDTH,
      height: LABEL_HEIGHT,
    };
    const neighbour = row[leftSide ? i - 1 : i + 1];
    if (neighbour && !p.isBox && overlaps(box, neighbour)) box.y = Math.max(40, neighbour.y - LABEL_HEIGHT - 10);

    const align = leftSide ? "right" : "left";
    const layers = [
      text(p.item.name, box.x, box.y, { size: NAME_SIZE, color: DECK_COLORS.ink, width: LABEL_WIDTH, align, name: `${p.item.name} label` }),
    ];
    if (p.item.caption) {
      layers.push(
        text(p.item.caption, box.x, box.y + NAME_SIZE * 1.15, {
          size: CAPTION_SIZE,
          color: DECK_COLORS.ink,
          width: LABEL_WIDTH,
          align,
          name: `${p.item.name} caption`,
        }),
      );
    }
    return layers;
  });
}

function itemPage(
  titleParts: [string, string],
  price: number | null,
  note: string,
  logo: Photo | null,
  middle: Layer[],
): HamperCanvas {
  const [title, subtitle] = titleParts;
  const layers: Layer[] = [
    text(title, 86, 64, { size: 82, color: DECK_COLORS.heading, width: 1200, name: "Title" }),
    text(subtitle, 86, 158, { size: 40, color: DECK_COLORS.heading, width: 1200, name: "Subtitle" }),
    rect(BAND.x, BAND.y, BAND.width, BAND.height, DECK_COLORS.green, "Band"),
    ...middle,
  ];
  if (price != null) {
    layers.push(
      text(`Price : ${formatInr(price)} + Tax`, 1213, 88, { size: 18, style: "bold", color: DECK_COLORS.heading, width: 600, align: "right", name: "Price" }),
      text("Shipping & Packaging\nWill Cost you Extra", 1213, 112, {
        size: 14,
        color: DECK_COLORS.muted,
        width: 600,
        align: "right",
        name: "Price note",
      }),
    );
  }
  if (logo) layers.push(logoLayer(logo, 190, "bottom-left"));
  if (note.trim()) {
    layers.push(text(note, 1128, 972, { size: 17, color: DECK_COLORS.muted, width: 700, align: "right", lineHeight: 1.3, name: "Terms" }));
  }
  return page(DECK_COLORS.page, layers);
}

const bandMessage = (message: string) =>
  text(message, BAND.x, BAND.y + BAND.height / 2 - 16, { size: 28, color: DECK_COLORS.heading, width: BAND.width, align: "center", name: "Placeholder" });

export function hamperSlide(h: HamperInfo, sizeOf: SizeOf, note: string, logo: Photo | null): HamperCanvas {
  const seen = new Set<string>();
  const withPhotos = h.items.flatMap((item) => {
    const size = item.image_url ? sizeOf(item.image_url) : undefined;
    const key = item.product_id ?? item.name;
    if (!item.image_url || !size || seen.has(key)) return [];
    seen.add(key);
    return [{ item, url: item.image_url, size }];
  });

  let middle: Layer[];
  if (withPhotos.length) {
    const row = arrangeRow(withPhotos);
    // The box is drawn first so the other items sit in front of it.
    const byDepth = [...row].sort((a, b) => Number(b.isBox) - Number(a.isBox));
    middle = [...byDepth.map((p) => photo(p.url, p, p.item.product_id, p.item.name)), ...labels(row)];
  } else if (h.image_url && sizeOf(h.image_url)) {
    const { width, height } = fitPhoto(sizeOf(h.image_url)!, 560, 1100);
    middle = [photo(h.image_url, { x: SLIDE.width / 2 - width / 2, y: BASELINE - height, width, height }, null, "Hamper image")];
  } else {
    middle = [bandMessage("Add product photos to show this hamper's contents")];
  }
  return itemPage(splitTitle(h.name, "Hamper"), h.price, note, logo, middle);
}

export function productSlide(p: ProductInfo, sizeOf: SizeOf, note: string, logo: Photo | null): HamperCanvas {
  const size = p.image_url ? sizeOf(p.image_url) : undefined;
  let middle: Layer[];
  if (p.image_url && size) {
    const { width, height } = fitPhoto(size, 520, 900);
    const placed: Placed = {
      item: { product_id: p.id, name: p.name, caption: p.caption, image_url: p.image_url },
      url: p.image_url,
      isBox: false,
      x: SLIDE.width / 2 - width / 2,
      y: BASELINE - height,
      width,
      height,
    };
    middle = [photo(p.image_url, placed, p.id, p.name), ...labels([placed])];
  } else {
    middle = [bandMessage("Add a photo to this product to show it here")];
  }
  return itemPage([p.name, p.caption], p.price, note, logo, middle);
}

export const blankSlide = (): HamperCanvas => page(DECK_COLORS.page, []);

/* ------------------------------------------------------------ PowerPoint */

/** PowerPoint measures in inches; slides use 144 px per inch, so 1920 px = 13.33" (16:9 widescreen). */
export const PX_PER_INCH = 144;

/**
 * A text layer as a native PowerPoint text box. Konva rotates a box about its
 * top-left corner, PowerPoint about its centre, so the box is placed where
 * Konva's rotated centre lands. `height` is the laid-out text height in px.
 */
export function pptTextBox(l: Extract<Layer, { kind: "text" }>, height: number) {
  const sx = Math.abs(l.scaleX);
  const sy = Math.abs(l.scaleY);
  const w = l.width * sx;
  const h = height * sy;
  const rad = (l.rotation * Math.PI) / 180;
  const cx = l.x + (w / 2) * Math.cos(rad) - (h / 2) * Math.sin(rad);
  const cy = l.y + (w / 2) * Math.sin(rad) + (h / 2) * Math.cos(rad);
  const inch = (px: number) => px / PX_PER_INCH;
  const pt = (px: number) => (px * 72) / PX_PER_INCH;
  const color = (l.fill.type === "solid" ? l.fill.color : l.fill.from).slice(1).toUpperCase();

  return {
    x: inch(cx - w / 2),
    y: inch(cy - h / 2),
    w: inch(w),
    h: inch(h),
    rotate: ((l.rotation % 360) + 360) % 360,
    fontFace: l.fontFamily,
    fontSize: Math.round(pt(l.fontSize * sy) * 10) / 10,
    bold: l.fontStyle.includes("bold"),
    italic: l.fontStyle.includes("italic"),
    underline: l.textDecoration === "underline" ? { style: "sng" as const } : undefined,
    color,
    align: l.align,
    valign: "top" as const,
    charSpacing: pt(l.letterSpacing * sx),
    lineSpacingMultiple: l.lineHeight,
    transparency: Math.round((1 - l.opacity) * 100),
    margin: 0,
    fit: "none" as const,
  };
}
