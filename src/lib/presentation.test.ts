import { test } from "node:test";
import assert from "node:assert/strict";
import { CanvasSchema } from "./hamper-canvas.ts";
import {
  closingSlide,
  contentsText,
  coverSlide,
  hamperSlide,
  pptTextBox,
  productSlide,
  SLIDE,
} from "./presentation.ts";

const valid = (c: unknown) => {
  const r = CanvasSchema.safeParse(c);
  assert.ok(r.success, r.success ? "" : JSON.stringify(r.error.issues[0]));
};

test("generated slides are valid designer canvases with unique layer ids", () => {
  const slides = [
    coverSlide("Diwali 2026", "Prepared for Acme"),
    hamperSlide({
      id: "h", code: "H0001", name: "Grand", collection: null, price: 2450, image_url: "https://e.com/h.png",
      contents: [{ name: "Tray", qty: 2 }],
    }),
    hamperSlide({ id: "h2", code: "H0002", name: "No photo", collection: null, price: null, image_url: null, contents: [] }),
    productSlide({
      id: "11111111-1111-4111-8111-111111111111", code: "P1", name: "Tray", price: 900,
      image_url: "https://e.com/p.png", colors: ["Walnut", "Black"],
    }),
    closingSlide("", "hello@latticelane.com"),
  ];
  for (const s of slides) {
    valid(s);
    assert.equal(s.width, SLIDE.width);
  }
  const ids = slides.flatMap((s) => s.layers.map((l) => l.id));
  assert.equal(new Set(ids).size, ids.length);

  const hamper = slides[1];
  assert.ok(hamper.layers.some((l) => l.kind === "image" && l.fit === "contain"));
  assert.ok(hamper.layers.some((l) => l.kind === "text" && l.text.includes("2 × Tray")));
  // Missing price/photo/contents leave those layers out rather than showing blanks.
  assert.ok(!slides[2].layers.some((l) => l.name === "Price" || l.kind === "image" || l.name === "Contents"));
  assert.ok(closingSlide("", "").layers.some((l) => l.kind === "text" && l.text === "Thank you"));
});

test("contentsText caps long hampers", () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ name: `Item ${i + 1}`, qty: 1 }));
  const lines = contentsText(many).split("\n");
  assert.equal(lines.length, 11);
  assert.equal(lines.at(-1), "+ 5 more");
  assert.equal(contentsText([{ name: "Jar", qty: 1 }]), "•  Jar");
});

test("pptTextBox converts px to inches/points and keeps the rotated centre", () => {
  const layer = {
    id: "t", visible: true, locked: false, kind: "text" as const, x: 144, y: 288, rotation: 0,
    scaleX: 1, scaleY: 1, opacity: 0.75, text: "Hi", fontSize: 48, fontFamily: "Inter",
    fontStyle: "bold" as const, align: "center" as const, width: 288, letterSpacing: 4, lineHeight: 1.2,
    fill: { type: "solid" as const, color: "#54655b" },
  };
  const b = pptTextBox(layer, 144);
  assert.deepEqual([b.x, b.y, b.w, b.h], [1, 2, 2, 1]);
  assert.equal(b.fontSize, 24);
  assert.equal(b.charSpacing, 2);
  assert.equal(b.color, "54655B");
  assert.equal(b.transparency, 25);
  assert.equal(b.bold, true);

  // Rotated 90° about its top-left corner: the centre swings to x - h/2, y + w/2.
  const r = pptTextBox({ ...layer, rotation: 90 }, 144);
  assert.ok(Math.abs(r.x - (144 - 72 - 144) / 144) < 1e-9);
  assert.ok(Math.abs(r.y - (288 + 144 - 72) / 144) < 1e-9);
  assert.equal(r.rotate, 90);
});
