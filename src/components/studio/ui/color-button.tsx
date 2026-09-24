"use client";

import { fillCss, type Fill } from "@/lib/hamper-canvas";
import { Popover } from "./base";
import { ColorPanel } from "./color-panel";

/** Canva-style colour swatch button in the toolbar. */
export function ColorButton({
  fill,
  onChange,
  documentColors,
  title,
  allowGradient,
  letter,
}: {
  fill: Fill;
  onChange: (fill: Fill) => void;
  documentColors: string[];
  title: string;
  allowGradient?: boolean;
  /** Show as an "A" underlined with the colour, like Canva's text colour. */
  letter?: boolean;
}) {
  return (
    <Popover
      title={title}
      width={264}
      trigger={
        letter ? (
          <span className="flex flex-col items-center leading-none">
            <span className="text-[15px] font-semibold">A</span>
            <span className="mt-0.5 h-1 w-5 rounded-full" style={{ background: fillCss(fill) }} />
          </span>
        ) : (
          <span className="h-6 w-6 rounded-md border border-black/15" style={{ background: fillCss(fill) }} />
        )
      }
    >
      <ColorPanel fill={fill} onChange={onChange} documentColors={documentColors} allowGradient={allowGradient} />
    </Popover>
  );
}
