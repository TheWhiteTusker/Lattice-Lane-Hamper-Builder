"use client";

import { useEffect, useState } from "react";
import { Ellipse, Image as KImage, Line, Rect, RegularPolygon, Star } from "react-konva";
import { layerConfig, type Layer } from "@/lib/hamper-canvas";
import { loadImage } from "../render";

/** Canvas-drawn colours; keep in step with the .studio tokens in studio.css. */
export const STUDIO_COLORS = {
  accent: "#54655b", // sage
  guide: "#b8962e", // deep gold, visible on white and cream pages alike
  locked: "#a8a28f",
  handleFill: "#faf8ee",
  pageShadow: "#2c332f",
};
export const ACCENT = STUDIO_COLORS.accent;
export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 4;

export type Guides = { vertical: number[]; horizontal: number[] };

export function useImage(url: string | null) {
  const [img, setImg] = useState<{ url: string; el: HTMLImageElement } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    loadImage(url).then((el) => live && setImg({ url, el }), () => {});
    return () => {
      live = false;
    };
  }, [url]);
  return url && img?.url === url ? img.el : undefined;
}

export const KONVA_SHAPES = { Rect, Ellipse, RegularPolygon, Star, Line } as unknown as Record<
  "Rect" | "Ellipse" | "RegularPolygon" | "Star" | "Line",
  React.ComponentType<Record<string, unknown>>
>;

export function LayerImage({ layer, common }: { layer: Extract<Layer, { kind: "image" }>; common: Record<string, unknown> }) {
  const img = useImage(layer.url);
  return <KImage {...layerConfig(layer, img).attrs} {...common} image={img} />;
}
