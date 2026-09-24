/** Cover, item and closing slides of a deck. */

import type { HamperCanvas, Layer } from "./hamper-canvas.ts";
import { DECK_COLORS, SLIDE, type HamperInfo, type Photo, type ProductInfo, type SizeOf } from "./deck-types.ts";
import { formatInr, logoLayer, page, photo, rect, splitTitle, text } from "./deck-layers.ts";
import { BAND, BASELINE, arrangeRow, fitPhoto, labels, type Placed } from "./deck-row.ts";

export function coverSlide(title: string, subtitle: string, logo: Photo | null): HamperCanvas {
  const layers: Layer[] = [
    text(title || "Premium", 61, 64, { size: 88, color: DECK_COLORS.heading, width: 1400, name: "Title" }),
    text(subtitle, 61, 164, { size: 38, color: DECK_COLORS.heading, width: 1400, name: "Subtitle" }),
  ];
  if (logo) layers.push(logoLayer(logo, 300, "bottom-right"));
  return page(DECK_COLORS.green, layers);
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
