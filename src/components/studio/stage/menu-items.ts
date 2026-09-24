import type { Layer } from "@/lib/hamper-canvas";
import type { Editor } from "../editor";
import type { CanvasDoc } from "./use-canvas-doc";

export type MenuItem = [label: string, keys: string, run: (() => unknown) | null] | null;

export const isLine = (l: Layer) => l.kind === "line" || l.kind === "curve";
export const hasFill = (l: Layer) => l.kind === "rect" || l.kind === "ellipse" || l.kind === "polygon" || l.kind === "star";
export const isShape = (l: Layer) => hasFill(l) || isLine(l);

/** The right-click menu: actions on the selection, or on the page when nothing is selected. */
export function menuItems({
  doc,
  ed,
  snapRightAngles,
  toggleSnap,
  zoomFit,
  recenter,
  editColor,
}: {
  doc: CanvasDoc;
  ed: Editor;
  snapRightAngles: boolean;
  toggleSnap: () => void;
  zoomFit: () => void;
  recenter: () => void;
  editColor: (mode: "fill" | "stroke") => void;
}): MenuItem[] {
  const { selection, selectedIds: ids, selected, clipboard, paste, canvas } = doc;
  const snapItem: MenuItem = [snapRightAngles ? "✓ Snap right angles (90°)" : "Snap right angles (90°)", "", toggleSnap];

  if (!selection.length) {
    return [
      ["Paste", "Ctrl+V", clipboard.length ? paste : null],
      ["Select all", "Ctrl+A", canvas.layers.length ? doc.selectAll : null],
      ["Fit page to screen", "Ctrl+0", zoomFit],
      ["Re-centre at current size", "", recenter],
      null,
      snapItem,
    ];
  }

  const multi = selection.length > 1;
  const onlyLines = selection.every(isLine);
  const fills = selection.some(hasFill);
  const strokes = selection.some((l) => "stroke" in l);
  const allLocked = selection.every((l) => l.locked);
  const colour: MenuItem[] = selection.some(isShape)
    ? [
        ...(fills ? [["Edit fill colour…", "", () => editColor("fill")] as MenuItem] : []),
        ...(strokes
          ? [[onlyLines ? "Edit line colour…" : "Edit border colour…", "", () => editColor("stroke")] as MenuItem]
          : []),
        null,
      ]
    : [];

  return [
    ...colour,
    ["Copy", "Ctrl+C", () => doc.setClipboard(selection)],
    ["Paste", "Ctrl+V", clipboard.length ? paste : null],
    [multi ? `Duplicate ${selection.length} elements` : "Duplicate", "Ctrl+D", () => doc.duplicate(ids)],
    [multi ? `Delete ${selection.length} elements` : "Delete", "Del", () => doc.remove(ids)],
    null,
    ["Bring forward", "Ctrl+]", () => ed.move(ids, "forward")],
    ["Bring to front", "Ctrl+Shift+]", () => ed.move(ids, "front")],
    ["Send backward", "Ctrl+[", () => ed.move(ids, "backward")],
    ["Send to back", "Ctrl+Shift+[", () => ed.move(ids, "back")],
    null,
    ...(selected?.kind === "image"
      ? ([
          ["Swap image", "", () => ed.startSwap(selected.id)],
          ["Fit to page", "", () => ed.fitToPage(selected.id)],
        ] as MenuItem[])
      : []),
    ...(multi
      ? ([
          ["Align centres", "", () => ed.align(ids, "center")],
          ["Align middles", "", () => ed.align(ids, "middle")],
        ] as MenuItem[])
      : ([["Align to page centre", "", () => (ed.align(ids, "center"), ed.align(ids, "middle"))]] as MenuItem[])),
    [allLocked ? "Unlock" : "Lock", "", () => doc.patchEach(ids, { locked: !allLocked })],
    ["Hide", "", () => doc.patchEach(ids, { visible: false })],
    ...(onlyLines ? [null, snapItem] : []),
  ];
}
