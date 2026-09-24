import { layerLabel } from "@/lib/hamper-canvas";
import type { SlideInput } from "../deck-schemas";
import type { SlideSummary } from "./page";

export const KIND_LABEL: Record<string, string> = {
  cover: "Entry slide",
  hamper: "Hamper",
  product: "Product",
  closing: "Ending slide",
  blank: "Blank",
};

/** A slide on the page: saved ones have a database id; ones added since the last save carry their full row. */
export type DraftSlide = SlideSummary & { unsaved?: SlideInput };

export function slideName(s: SlideSummary) {
  const t = s.canvas.layers.find((l) => l.kind === "text" && l.name === "Title");
  return t ? layerLabel(t) : KIND_LABEL[s.kind] ?? "Slide";
}

/** New slides go before a trailing ending slide. */
export function insertBeforeClosing(slides: DraftSlide[], added: DraftSlide[]) {
  return slides.at(-1)?.kind === "closing"
    ? [...slides.slice(0, -1), ...added, slides.at(-1)!]
    : [...slides, ...added];
}

export const draftOf = (input: SlideInput): DraftSlide => ({
  id: `new-${crypto.randomUUID()}`,
  kind: input.kind,
  canvas: input.canvas as SlideSummary["canvas"],
  unsaved: input,
});
