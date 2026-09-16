"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { SlideThumb } from "@/components/studio/slide-thumb";
import { exportPptx } from "@/components/studio/export-pptx";
import { layerLabel } from "@/lib/hamper-canvas";
import {
  addSlides,
  deletePresentation,
  deleteSlide,
  moveSlide,
  renamePresentation,
  type DeckItem,
} from "../actions";
import { ItemPicker, type PickerData } from "../item-picker";
import type { SlideSummary } from "./page";

const KIND_LABEL: Record<string, string> = {
  cover: "Entry slide",
  hamper: "Hamper",
  product: "Product",
  closing: "Ending slide",
  blank: "Blank",
};

/** The slide's own name: the first text on it that isn't the wordmark or a price. */
function slideName(s: SlideSummary) {
  const t = s.canvas.layers.find((l) => l.kind === "text" && (l.name === "Name" || l.name === "Title"));
  return t ? layerLabel(t) : KIND_LABEL[s.kind] ?? "Slide";
}

export function DeckOverview({
  deck,
  slides,
  picker,
}: {
  deck: { id: string; title: string };
  slides: SlideSummary[];
  picker: PickerData;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(deck.title);
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<DeckItem[]>([]);
  const [exporting, setExporting] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string } | void>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res && res.error) setError(res.error);
    });

  async function downloadPptx() {
    setError(null);
    try {
      await exportPptx(deck.title, slides.map((s) => s.canvas), (done) =>
        setExporting(done < slides.length ? `Building slide ${done + 1} of ${slides.length}…` : "Saving file…"),
      );
    } catch {
      setError("Could not build the PowerPoint. An image from another website may be blocking the export.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <PageHeader title={deck.title} subtitle={`${slides.length} slides`}>
        <Link href={`/presentations/${deck.id}/print`} prefetch={false} target="_blank" className="btn-secondary">
          Download PDF
        </Link>
        <button type="button" className="btn-primary" onClick={downloadPptx} disabled={!!exporting || !slides.length}>
          {exporting ?? "Download PowerPoint"}
        </button>
      </PageHeader>

      {error && <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      <form
        className="card mb-4 flex flex-wrap items-end gap-3 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => renamePresentation(deck.id, title));
        }}
      >
        <div className="min-w-64 flex-1">
          <label className="label" htmlFor="deck-title">
            Presentation name
          </label>
          <input id="deck-title" className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <button type="submit" className="btn-secondary" disabled={pending || title.trim() === deck.title}>
          Rename
        </button>
        <button
          type="button"
          className="btn-danger ml-auto"
          disabled={pending}
          onClick={() => confirm(`Delete "${deck.title}" and all its slides?`) && run(() => deletePresentation(deck.id))}
        >
          Delete presentation
        </button>
      </form>

      <p className="mb-3 text-sm text-[var(--color-muted)]">
        Click a slide to edit it in the photo editor. The entry and ending slides are edited the same way.
      </p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {slides.map((s, i) => (
          <div key={s.id} className="card overflow-hidden">
            <Link href={`/presentations/${deck.id}/slides/${s.id}`} prefetch={false} className="block bg-[var(--color-paper)] p-2 hover:opacity-90">
              <SlideThumb canvas={s.canvas} width={240} className="mx-auto rounded shadow-sm" />
            </Link>
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="w-6 text-sm tabular-nums text-[var(--color-muted)]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{slideName(s)}</div>
                <div className="text-xs text-[var(--color-muted)]">{KIND_LABEL[s.kind] ?? s.kind}</div>
              </div>
              <button
                type="button"
                aria-label="Move earlier"
                className="px-1 disabled:opacity-30"
                disabled={pending || i === 0}
                onClick={() => run(() => moveSlide(deck.id, s.id, -1))}
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Move later"
                className="px-1 disabled:opacity-30"
                disabled={pending || i === slides.length - 1}
                onClick={() => run(() => moveSlide(deck.id, s.id, 1))}
              >
                →
              </button>
              <button
                type="button"
                aria-label="Delete slide"
                className="px-1 text-red-700 disabled:opacity-30"
                disabled={pending}
                onClick={() => confirm(`Delete slide ${i + 1}?`) && run(() => deleteSlide(deck.id, s.id))}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <section className="mt-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => setAdding((v) => !v)}>
            {adding ? "Close" : "Add hamper or product slides"}
          </button>
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(() => addSlides(deck.id, "blank"))}>
            Add blank slide
          </button>
        </div>

        {adding && (
          <>
            <ItemPicker {...picker} value={toAdd} onChange={setToAdd} />
            <button
              type="button"
              className="btn-primary"
              disabled={pending || !toAdd.length}
              onClick={() =>
                run(async () => {
                  const res = await addSlides(deck.id, toAdd);
                  if (!res.error) {
                    setToAdd([]);
                    setAdding(false);
                  }
                  return res;
                })
              }
            >
              {pending ? "Adding…" : `Add ${toAdd.length} slide${toAdd.length === 1 ? "" : "s"}`}
            </button>
            <p className="text-xs text-[var(--color-muted)]">New slides go before the ending slide.</p>
          </>
        )}
      </section>
    </>
  );
}
