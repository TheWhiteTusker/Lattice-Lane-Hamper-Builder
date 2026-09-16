import { test } from "node:test";
import assert from "node:assert/strict";
import { removeBackground } from "./background-removal.ts";

/** Paint a w×h RGBA image from rows of chars: W white, R red. */
function image(rows: string[]) {
  const colors: Record<string, number[]> = { W: [255, 255, 255], R: [200, 0, 0], w: [250, 250, 250] };
  const data = new Uint8ClampedArray(rows.length * rows[0].length * 4);
  rows.join("").split("").forEach((ch, i) => data.set([...colors[ch], 255], i * 4));
  return { data, w: rows[0].length, h: rows.length };
}
const alpha = (data: Uint8ClampedArray, w: number) =>
  Array.from({ length: data.length / 4 }, (_, i) => (data[i * 4 + 3] === 0 ? "." : data[i * 4 + 3] === 255 ? "#" : "~"))
    .join("")
    .match(new RegExp(`.{${w}}`, "g"));

test("removes the backdrop but keeps enclosed near-white pixels inside the product", () => {
  const { data, w, h } = image([
    "WWWWWWW",
    "WRRRRRW",
    "WRWWWRW",
    "WRRRRRW",
    "wWWWWWW",
  ]);
  removeBackground(data, w, h, 30);
  assert.deepEqual(alpha(data, w), [
    ".......",
    ".#####.",
    ".#####.",
    ".#####.",
    ".......",
  ]);
});

test("feathers pixels just past the tolerance at the edge", () => {
  const { data, w, h } = image(["WWW", "WWW", "WWW"]);
  // Centre pixel slightly grey: distance ~26 from white.
  data.set([240, 240, 240], 4 * 4);
  removeBackground(data, w, h, 20);
  assert.equal(alpha(data, w)!.join(""), "....~....");
});
