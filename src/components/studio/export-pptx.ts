"use client";

import type { HamperCanvas } from "@/lib/hamper-canvas";
import { PX_PER_INCH, pptTextBox } from "@/lib/presentation";
import { renderCanvas } from "./render";

/**
 * Builds a .pptx in the browser: each slide's shapes, photos and background
 * become one full-bleed picture, and its text layers become real PowerPoint
 * text boxes on top, so wording can still be edited in PowerPoint.
 * Fonts PowerPoint doesn't have installed fall back to its defaults.
 */
export async function exportPptx(fileName: string, slides: HamperCanvas[], onProgress?: (done: number) => void) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  const first = slides[0];
  // ponytail: one page size per file (PowerPoint's limit); odd-sized slides are stretched to the first slide's size.
  pptx.defineLayout({ name: "DECK", width: first.width / PX_PER_INCH, height: first.height / PX_PER_INCH });
  pptx.layout = "DECK";

  for (const [i, canvas] of slides.entries()) {
    onProgress?.(i);
    const { dataUrl, texts } = await renderCanvas(canvas, { skipText: true });
    const slide = pptx.addSlide();
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: first.width / PX_PER_INCH, h: first.height / PX_PER_INCH });
    for (const t of texts) {
      if (!t.layer.text.trim()) continue;
      slide.addText(t.layer.text, pptTextBox(t.layer, t.height));
    }
  }
  onProgress?.(slides.length);
  await pptx.writeFile({ fileName: fileName.endsWith(".pptx") ? fileName : `${fileName}.pptx` });
}
