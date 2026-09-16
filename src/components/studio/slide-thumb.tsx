"use client";

import { useEffect, useState } from "react";
import type { HamperCanvas } from "@/lib/hamper-canvas";
import { renderCanvas } from "./render";

/**
 * A small live preview of a design, drawn in the browser.
 * ponytail: renders each thumbnail from scratch; cache PNGs server-side if decks grow past a few dozen slides.
 */
export function SlideThumb({ canvas, width, className }: { canvas: HamperCanvas; width: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    renderCanvas(canvas, { pixelRatio: (width * 2) / canvas.width }).then(
      (r) => live && setSrc(r.dataUrl),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [canvas, width]);

  return (
    <div
      className={["overflow-hidden bg-[#e3ddcc]", className].filter(Boolean).join(" ")}
      style={{ width, aspectRatio: `${canvas.width} / ${canvas.height}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="" className="block h-full w-full" />}
    </div>
  );
}
