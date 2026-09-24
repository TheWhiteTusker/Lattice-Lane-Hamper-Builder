/** Lays hamper photos out in a row on the green band, with labels. */

import type { Layer } from "./hamper-canvas.ts";
import { DECK_COLORS, SLIDE, type DeckItemInfo, type Size } from "./deck-types.ts";
import { text } from "./deck-layers.ts";

export const BAND = { x: 82, y: 529, width: 1746, height: 371 };
export const BASELINE = 775; // where photos stand, inside the band
const ROW_WIDTH = 1500;
const LABEL_WIDTH = 320;
const NAME_SIZE = 22;
const CAPTION_SIZE = 15;
const LABEL_HEIGHT = NAME_SIZE * 1.15 + CAPTION_SIZE * 1.15;

export type Placed = { item: DeckItemInfo; url: string; x: number; y: number; width: number; height: number; isBox: boolean };

const isBox = (item: DeckItemInfo) => /\bbox/i.test(`${item.caption} ${item.name}`);

/** Scale a photo to a target height, capping its width so wide items don't dominate. */
export function fitPhoto(size: Size, targetHeight: number, maxWidth: number) {
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
export function labels(row: Placed[]): Layer[] {
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
