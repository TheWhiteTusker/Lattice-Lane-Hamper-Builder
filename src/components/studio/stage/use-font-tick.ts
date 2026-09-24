import { useEffect, useState } from "react";
import type { HamperCanvas } from "@/lib/hamper-canvas";
import { ensureFontStylesheet, fontFaces } from "../render";

/** Bumps whenever web fonts finish loading, so Konva text redraws in the right face. */
export function useFontTick(canvas: HamperCanvas) {
  const [fontTick, setFontTick] = useState(0);

  useEffect(() => {
    ensureFontStylesheet();
    const bump = () => setFontTick((t) => t + 1);
    document.fonts.addEventListener("loadingdone", bump);
    return () => document.fonts.removeEventListener("loadingdone", bump);
  }, []);

  const faces = fontFaces(canvas).join("|");
  useEffect(() => {
    if (!faces) return;
    Promise.all(faces.split("|").map((f) => document.fonts.load(f).catch(() => []))).then(() => setFontTick((t) => t + 1));
  }, [faces]);

  return fontTick;
}
