/**
 * Makes a product photo's plain background transparent, in place.
 *
 * Flood-fills inward from the image border through every pixel close to the
 * border colour, so a white product on a white backdrop keeps its inside
 * (the fill can't reach it past the outline). Pixels just past the tolerance
 * that touch the removed area are feathered, which softens the jagged edge.
 *
 * ponytail: colour-distance flood fill, so it only handles plain/near-plain
 * backdrops. Busy or photographic backgrounds need an AI matting service
 * (e.g. remove.bg) instead.
 */
export function removeBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance: number,
) {
  const n = width * height;
  const key = borderColor(data, width, height);
  const feather = tolerance * 0.5;

  const dist = (i: number) => {
    const p = i * 4;
    if (data[p + 3] === 0) return 0; // already transparent counts as background
    const dr = data[p] - key[0];
    const dg = data[p + 1] - key[1];
    const db = data[p + 2] - key[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  const removed = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;

  const push = (i: number) => {
    if (!removed[i] && dist(i) <= tolerance) {
      removed[i] = 1;
      stack[top++] = i;
    }
  };

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (top) {
    const i = stack[--top];
    const x = i % width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (i >= width) push(i - width);
    if (i < n - width) push(i + width);
  }

  for (let i = 0; i < n; i++) {
    if (removed[i]) {
      data[i * 4 + 3] = 0;
      continue;
    }
    if (feather <= 0) continue;
    const x = i % width;
    const touches =
      (x > 0 && removed[i - 1]) ||
      (x < width - 1 && removed[i + 1]) ||
      (i >= width && removed[i - width]) ||
      (i < n - width && removed[i + width]);
    if (!touches) continue;
    const d = dist(i) - tolerance;
    if (d < feather) data[i * 4 + 3] = Math.round((data[i * 4 + 3] * d) / feather);
  }
}

/** Average of the four corners: the backdrop colour on a typical product shot. */
function borderColor(data: Uint8ClampedArray, width: number, height: number) {
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  return [0, 1, 2].map((c) => corners.reduce((sum, i) => sum + data[i * 4 + c], 0) / 4);
}
