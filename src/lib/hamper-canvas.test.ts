import { test } from "node:test";
import assert from "node:assert/strict";
import {
  backgroundImageAttrs,
  layerConfig,
  alignBoxes,
  alignToPage,
  boundsOf,
  distributeBoxes,
  intersects,
  moveLayers,
  emptyCanvas,
  fillCss,
  fitScale,
  layerLabel,
  reorderLayer,
  fillProps,
  moveLayer,
  parseCanvas,
  record,
  redo,
  snap,
  startHistory,
  undo,
} from "./hamper-canvas.ts";

const ids = (layers: { id: string }[]) => layers.map((l) => l.id).join("");
const abc = [{ id: "a" }, { id: "b" }, { id: "c" }];

test("moveLayer reorders z-order and clamps at the ends", () => {
  assert.equal(ids(moveLayer(abc, "a", "front")), "bca");
  assert.equal(ids(moveLayer(abc, "c", "back")), "cab");
  assert.equal(ids(moveLayer(abc, "a", "forward")), "bac");
  assert.equal(ids(moveLayer(abc, "b", "backward")), "bac");
  assert.equal(moveLayer(abc, "c", "forward"), abc);
  assert.equal(moveLayer(abc, "a", "backward"), abc);
  assert.equal(moveLayer(abc, "zz", "front"), abc);
});

test("fillProps: solid is a plain fill, gradients span the box", () => {
  assert.deepEqual(fillProps({ type: "solid", color: "#ff0000" }, 10, 10), { fill: "#ff0000" });

  const h = fillProps({ type: "linear", from: "#000000", to: "#ffffff", angle: 0 }, 100, 50);
  assert.deepEqual(h.fillLinearGradientStartPoint, { x: 0, y: 25 });
  assert.deepEqual(h.fillLinearGradientEndPoint, { x: 100, y: 25 });

  // Ellipse: box centred on the origin.
  const v = fillProps({ type: "linear", from: "#000000", to: "#ffffff", angle: 90 }, 40, 60, -20, -30);
  assert.ok(Math.abs(v.fillLinearGradientStartPoint!.x) < 1e-9);
  assert.ok(Math.abs(v.fillLinearGradientStartPoint!.y + 30) < 1e-9);
  assert.ok(Math.abs(v.fillLinearGradientEndPoint!.y - 30) < 1e-9);
});

test("parseCanvas round-trips a valid document and falls back on junk", () => {
  const doc = emptyCanvas();
  doc.layers.push(
    {
      id: "t1", visible: true, locked: false, letterSpacing: 0, lineHeight: 1, textDecoration: "none", kind: "text", x: 1, y: 2, rotation: 15, scaleX: 1, scaleY: 1, opacity: 1,
      text: "Hi", fontSize: 40, fontFamily: "Arial", fontStyle: "bold", align: "center", width: 300,
      fill: { type: "linear", from: "#111111", to: "#eeeeee", angle: 45 },
    },
    {
      id: "i1", visible: true, locked: false, fit: "stretch", kind: "image", x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 2, opacity: 0.5,
      product_id: null, url: "https://example.com/a.png", width: 200, height: 100,
    },
  );
  assert.deepEqual(parseCanvas(JSON.parse(JSON.stringify(doc))), doc);
  assert.deepEqual(parseCanvas(null), emptyCanvas());
  assert.deepEqual(parseCanvas({ layers: "nope" }), emptyCanvas());
});

test("history: undo/redo, grouping of continuous edits, redo cleared by new edit", () => {
  let h = startHistory(0);
  h = record(h, 1, null, 0);
  h = record(h, 2, "slider", 100);
  h = record(h, 3, "slider", 200); // same group, within the window: one step
  assert.deepEqual([h.past, h.present], [[0, 1], 3]);

  h = record(h, 4, "slider", 5000); // window expired: new step
  assert.deepEqual(h.past, [0, 1, 3]);

  h = undo(undo(h));
  assert.equal(h.present, 1);
  assert.deepEqual(h.future, [3, 4]);
  h = redo(h);
  assert.equal(h.present, 3);

  h = record(h, 9, null, 6000);
  assert.deepEqual(h.future, []);
  assert.equal(record(h, 9, null, 7000), h); // no-op change records nothing
  assert.equal(undo(startHistory(0)).present, 0);
});

test("snap: nearest edge/centre within threshold, per axis", () => {
  const canvas = { width: 1000, height: 1000 };
  // Box centre at x=497 -> snaps to canvas centre 500; y has nothing near.
  const s = snap({ x: 447, y: 212, width: 100, height: 50 }, [], canvas, 8);
  assert.deepEqual(s, { dx: 3, dy: 0, vertical: [500], horizontal: [] });

  // Left edge 305 lines up with another item's right edge 300.
  const t = snap({ x: 305, y: 600, width: 50, height: 50 }, [{ x: 200, y: 0, width: 100, height: 20 }], canvas, 8);
  assert.equal(t.dx, -5);
  assert.deepEqual(t.vertical, [300]);
});

test("reorderLayer puts the layer at the target index from either direction", () => {
  assert.equal(ids(reorderLayer(abc, "a", 2)), "bca");
  assert.equal(ids(reorderLayer(abc, "c", 0)), "cab");
  assert.equal(ids(reorderLayer(abc, "a", 1)), "bac");
  assert.equal(ids(reorderLayer(abc, "a", 99)), "bca");
  assert.equal(reorderLayer(abc, "b", 1), abc);
});

test("alignToPage and fitScale", () => {
  const page = { width: 1000, height: 800 };
  const box = { x: 100, y: 100, width: 200, height: 100 };
  assert.deepEqual(alignToPage(box, page, "left"), { dx: -100, dy: 0 });
  assert.deepEqual(alignToPage(box, page, "center"), { dx: 300, dy: 0 });
  assert.deepEqual(alignToPage(box, page, "right"), { dx: 700, dy: 0 });
  assert.deepEqual(alignToPage(box, page, "middle"), { dx: 0, dy: 250 });
  assert.deepEqual(alignToPage(box, page, "bottom"), { dx: 0, dy: 600 });
  assert.equal(fitScale({ x: 0, y: 0, width: 2000, height: 400 }, page, 1), 0.5);
  assert.equal(fitScale(box, page), 1); // already fits: never enlarged
});

test("old saved designs get the new layer defaults", () => {
  const old = {
    ...emptyCanvas(),
    layers: [
      {
        id: "t", kind: "text", x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        text: "Hi", fontSize: 10, fontFamily: "Arial", fontStyle: "normal", align: "left", width: 50,
        fill: { type: "solid", color: "#000000" },
      },
    ],
  };
  const [t] = parseCanvas(old).layers;
  assert.equal(t.visible, true);
  assert.equal(t.locked, false);
  assert.equal(t.kind === "text" && t.lineHeight, 1);
  assert.equal(layerLabel(t), "Hi");
  assert.equal(fillCss({ type: "linear", from: "#000000", to: "#ffffff", angle: 0 }), "linear-gradient(90deg, #000000, #ffffff)");
});

test("moveLayers keeps the selection's own order", () => {
  const l = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  assert.equal(ids(moveLayers(l, ["b", "d"], "front")), "acebd");
  assert.equal(ids(moveLayers(l, ["b", "d"], "back")), "bdace");
  assert.equal(ids(moveLayers(l, ["b", "d"], "forward")), "acbed");
  assert.equal(ids(moveLayers(l, ["b", "d"], "backward")), "badce");
  // Adjacent selected layers move as a block, and a block already at the edge stays put.
  assert.equal(ids(moveLayers(l, ["c", "d"], "forward")), "abecd");
  assert.equal(moveLayers(l, ["d", "e"], "forward"), l);
  assert.equal(moveLayers(l, ["d", "e"], "front"), l);
  assert.equal(moveLayers(l, ["zz"], "front"), l);
});

test("multi-selection geometry: bounds, hit test, align and distribute", () => {
  const boxes = [
    { x: 0, y: 0, width: 10, height: 10 },
    { x: 50, y: 20, width: 20, height: 10 },
    { x: 100, y: 5, width: 10, height: 30 },
  ];
  assert.deepEqual(boundsOf(boxes), { x: 0, y: 0, width: 110, height: 35 });
  assert.equal(intersects(boxes[0], { x: 5, y: 5, width: 1, height: 1 }), true);
  assert.equal(intersects(boxes[0], { x: 10, y: 0, width: 5, height: 5 }), false);

  assert.deepEqual(alignBoxes(boxes, "left").map((d) => d.dx), [0, -50, -100]);
  assert.deepEqual(alignBoxes(boxes, "right").map((d) => d.dx), [100, 40, 0]);
  assert.deepEqual(alignBoxes(boxes, "top").map((d) => d.dy), [0, -20, -5]);

  // Widths 10+20+10 over a span of 110 leave two gaps of 35: middle box moves to x=45.
  assert.deepEqual(distributeBoxes(boxes, "x").map((d) => d.dx), [0, -5, 0]);
  // Order comes from position, not array order.
  const shuffled = [boxes[2], boxes[0], boxes[1]];
  assert.deepEqual(distributeBoxes(shuffled, "x").map((d) => d.dx), [0, 0, -5]);
  assert.deepEqual(distributeBoxes(boxes.slice(0, 2), "x"), [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
});

test("layerConfig: contain fits and centres the photo inside its frame", () => {
  const base = { id: "i", visible: true, locked: false, x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, product_id: null, url: "https://e.com/a.png" };
  const tall = { naturalWidth: 100, naturalHeight: 200 };
  const c = layerConfig({ ...base, kind: "image", width: 400, height: 400, fit: "contain" }, tall);
  assert.equal(c.shape, "Image");
  assert.deepEqual([c.attrs.width, c.attrs.height, c.attrs.offsetX, c.attrs.offsetY], [200, 400, -100, -0]);
  // Stretch (and contain before the image has loaded) keeps the frame size.
  const s = layerConfig({ ...base, kind: "image", width: 400, height: 400, fit: "stretch" }, tall);
  assert.deepEqual([s.attrs.width, s.attrs.height, s.attrs.offsetX], [400, 400, undefined]);

  assert.deepEqual(backgroundImageAttrs({ width: 1000, height: 500 }, { naturalWidth: 100, naturalHeight: 100 }), {
    width: 1000, height: 1000, x: 0, y: -250,
  });
});
