"use client";

import { closingSlide, coverSlide, hamperSlide, productSlide, type Size } from "@/lib/presentation";
import { loadImage } from "@/components/studio/render";
import { loadDeckData } from "./actions";
import type { DeckItem, SlideInput } from "./deck-schemas";

export type DeckText = {
  title: string;
  subtitle: string;
  closingHeading: string;
  closingTagline: string;
  closingContact: string;
  note: string;
};

/** Natural sizes of every photo; photos that fail to load are simply absent. */
async function measure(urls: string[]) {
  const sizes = new Map<string, Size>();
  await Promise.all(
    [...new Set(urls)].map(async (url) => {
      try {
        const img = await loadImage(url);
        sizes.set(url, { width: img.naturalWidth, height: img.naturalHeight });
      } catch {
        /* left out of the layout */
      }
    }),
  );
  return sizes;
}

/**
 * Lays out slides for the picked items in the browser, where the photos'
 * proportions are known. With `text`, adds the entry and closing slides too.
 */
export async function buildSlides(items: DeckItem[], note: string, text?: DeckText): Promise<SlideInput[]> {
  const data = await loadDeckData(items);
  if (data.error) throw new Error(data.error);

  const sizes = await measure([
    ...data.hampers.flatMap((h) => [h.image_url, ...h.items.map((i) => i.image_url)]),
    ...data.products.map((p) => p.image_url),
    ...(data.logo ? [data.logo.url] : []),
  ].filter((u): u is string => !!u));
  const sizeOf = (url: string) => sizes.get(url);
  const logo = data.logo && sizes.has(data.logo.url) ? { url: data.logo.url, size: sizes.get(data.logo.url)! } : null;

  const middle = items.flatMap((item): SlideInput[] => {
    if (item.type === "hamper") {
      const h = data.hampers.find((x) => x.id === item.id);
      return h ? [{ kind: "hamper", hamper_id: h.id, product_id: null, canvas: hamperSlide(h, sizeOf, note, logo) }] : [];
    }
    const p = data.products.find((x) => x.id === item.id);
    return p ? [{ kind: "product", hamper_id: null, product_id: p.id, canvas: productSlide(p, sizeOf, note, logo) }] : [];
  });

  if (!text) return middle;
  return [
    { kind: "cover", hamper_id: null, product_id: null, canvas: coverSlide(text.title, text.subtitle, logo) },
    ...middle,
    {
      kind: "closing",
      hamper_id: null,
      product_id: null,
      canvas: closingSlide(text.closingHeading, text.closingTagline, text.closingContact, logo),
    },
  ];
}
