"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { SlideThumb } from "@/components/studio/slide-thumb";
import { exportPptx } from "@/components/studio/export-pptx";
import { layerLabel } from "@/lib/hamper-canvas";
import { blankSlide, DEFAULT_NOTE } from "@/lib/presentation";
import { buildSlides } from "../build-slides";
import { deletePresentation, saveDeck, type DeckItem, type DeckSlideInput, type SlideInput } from "../actions";
import { ItemPicker, type PickerData } from "../item-picker";
import type { SlideSummary } from "./page";

const KIND_LABEL: Record<string, string> = {
  cover: "Entry slide",
  hamper: "Hamper",
  product: "Product",
  closing: "Ending slide",
  blank: "Blank",
};

/** A slide on the page: saved ones have a database id; ones added since the last save carry their full row. */
type DraftSlide = SlideSummary & { unsaved?: SlideInput };

function slideName(s: SlideSummary) {
  const t = s.canvas.layers.find((l) => l.kind === "text" && l.name === "Title");
  return t ? layerLabel(t) : KIND_LABEL[s.kind] ?? "Slide";
}

/** New slides go before a trailing ending slide. */
function insertBeforeClosing(slides: DraftSlide[], added: DraftSlide[]) {
  return slides.at(-1)?.kind === "closing"
    ? [...slides.slice(0, -1), ...added, slides.at(-1)!]
    : [...slides, ...added];
}

const draftOf = (input: SlideInput): DraftSlide => ({
  id: `new-${crypto.randomUUID()}`,
  kind: input.kind,
  canvas: input.canvas as SlideSummary["canvas"],
  unsaved: input,
});

export function DeckOverview({
  deck,
  slides: initialSlides,
  picker,
}: {
  deck: { id: string; title: string };
  slides: SlideSummary[];
  picker: PickerData;
}) {
  // Everything below is a draft kept on this page. Nothing is written until Save.
  const [slides, setSlides] = useState<DraftSlide[]>(initialSlides);
  const [title, setTitle] = useState(deck.title);
  const [saved, setSaved] = useState({ title: deck.title, ids: initialSlides.map((s) => s.id).join() });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<DeckItem[]>([]);
  const [layingOut, setLayingOut] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [deleting, startDelete] = useTransition();

  const dirty = title.trim() !== saved.title || slides.map((s) => s.id).join() !== saved.ids;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const edit = (fn: (list: DraftSlide[]) => DraftSlide[]) => {
    setSlides(fn);
    setError(null);
    setNotice(null);
  };

  const move = (id: string, by: -1 | 1) =>
    edit((list) => {
      const i = list.findIndex((s) => s.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const remove = (id: string) => edit((list) => list.filter((s) => s.id !== id));

  const addBlank = () =>
    edit((list) => insertBeforeClosing(list, [draftOf({ kind: "blank", hamper_id: null, product_id: null, canvas: blankSlide() })]));

  async function addItems() {
    setError(null);
    setLayingOut(true);
    try {
      // Laying out reads hamper details and photo sizes; the slides still only join the draft.
      const built = await buildSlides(toAdd, DEFAULT_NOTE);
      edit((list) => insertBeforeClosing(list, built.map(draftOf)));
      setToAdd([]);
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not lay out the new slides.");
    } finally {
      setLayingOut(false);
    }
  }

  const save = () =>
    startSaving(async () => {
      setError(null);
      setNotice(null);
      const payload: DeckSlideInput[] = slides.map((s) => (s.unsaved ? { ...s.unsaved, tempId: s.id } : { id: s.id }));
      const res = await saveDeck(deck.id, { title: title.trim(), slides: payload });
      if (res.error) {
        setError(res.error);
        return;
      }
      // Swap temporary ids for the real ones so the new slides can be opened.
      const next = slides.map((s) => (s.unsaved && res.ids?.[s.id] ? { id: res.ids[s.id], kind: s.kind, canvas: s.canvas } : s));
      setSlides(next);
      setSaved({ title: title.trim(), ids: next.map((s) => s.id).join() });
      setNotice("Saved.");
    });

  const discard = () => {
    if (!confirm("Discard your unsaved changes?")) return;
    setSlides(initialSlides);
    setTitle(saved.title);
    // initialSlides is what the page loaded with; after an earlier save, reload to get the saved state.
    if (initialSlides.map((s) => s.id).join() !== saved.ids) window.location.reload();
  };

  /** Leaving for a slide editor would lose the draft; ask first. */
  const guard = (e: React.MouseEvent) => {
    if (dirty && !confirm("You have unsaved changes to this presentation. Leave without saving?")) e.preventDefault();
  };

  async function downloadPptx() {
    setError(null);
    try {
      await exportPptx(title.trim() || saved.title, slides.map((s) => s.canvas), (done) =>
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
      <PageHeader title={saved.title} subtitle={`${slides.length} slides${dirty ? " · unsaved changes" : ""}`}>
        {dirty && (
          <button type="button" className="btn-secondary" onClick={discard} disabled={saving}>
            Discard
          </button>
        )}
        <button type="button" className="btn-primary" onClick={save} disabled={!dirty || saving || !title.trim()}>
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
        {dirty ? (
          <span className="btn-secondary cursor-not-allowed opacity-50" title="Save your changes first">
            Download PDF
          </span>
        ) : (
          <Link href={`/presentations/${deck.id}/print`} prefetch={false} target="_blank" className="btn-secondary">
            Download PDF
          </Link>
        )}
        <button type="button" className="btn-secondary" onClick={downloadPptx} disabled={!!exporting || !slides.length}>
          {exporting ?? "Download PowerPoint"}
        </button>
      </PageHeader>

      {error && <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {notice && !dirty && (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">{notice}</p>
      )}

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-64 flex-1">
          <label className="label" htmlFor="deck-title">
            Presentation name
          </label>
          <input
            id="deck-title"
            className="input mt-1"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setNotice(null);
            }}
          />
        </div>
        <button
          type="button"
          className="btn-danger ml-auto"
          disabled={deleting}
          onClick={() =>
            confirm(`Delete "${saved.title}" and all its slides?`) &&
            startDelete(async () => {
              const res = await deletePresentation(deck.id);
              if (res?.error) setError(res.error);
            })
          }
        >
          {deleting ? "Deleting…" : "Delete presentation"}
        </button>
      </div>

      <p className="mb-3 text-sm text-[var(--color-muted)]">
        Add, remove and reorder slides, then click <strong>Save changes</strong>. Click a slide to edit it in the photo editor.
      </p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {slides.map((s, i) => (
          <div key={s.id} className={`card overflow-hidden ${s.unsaved ? "ring-2 ring-[var(--color-gold)]" : ""}`}>
            {s.unsaved ? (
              <div className="relative bg-[var(--color-paper)] p-2" title="Save changes to edit this slide">
                <SlideThumb canvas={s.canvas} width={240} className="mx-auto rounded shadow-sm" />
                <span className="absolute right-3 top-3 rounded bg-[var(--color-ink)] px-1.5 py-0.5 text-[11px] text-white">New · save to edit</span>
              </div>
            ) : (
              <Link
                href={`/presentations/${deck.id}/slides/${s.id}`}
                prefetch={false}
                onClick={guard}
                className="block bg-[var(--color-paper)] p-2 hover:opacity-90"
              >
                <SlideThumb canvas={s.canvas} width={240} className="mx-auto rounded shadow-sm" />
              </Link>
            )}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="w-6 text-sm tabular-nums text-[var(--color-muted)]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{slideName(s)}</div>
                <div className="text-xs text-[var(--color-muted)]">{KIND_LABEL[s.kind] ?? s.kind}</div>
              </div>
              <button type="button" aria-label="Move earlier" className="px-1 disabled:opacity-30" disabled={i === 0} onClick={() => move(s.id, -1)}>
                ←
              </button>
              <button
                type="button"
                aria-label="Move later"
                className="px-1 disabled:opacity-30"
                disabled={i === slides.length - 1}
                onClick={() => move(s.id, 1)}
              >
                →
              </button>
              <button type="button" aria-label="Remove slide" className="px-1 text-red-700" onClick={() => remove(s.id)}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <section className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => setAdding((v) => !v)}>
            {adding ? "Close" : "Add hamper or product slides"}
          </button>
          <button type="button" className="btn-secondary" onClick={addBlank}>
            Add blank slide
          </button>
        </div>

        {adding && (
          <>
            <ItemPicker {...picker} value={toAdd} onChange={setToAdd} />
            <button type="button" className="btn-primary" disabled={layingOut || !toAdd.length} onClick={addItems}>
              {layingOut ? "Laying out slides…" : `Add ${toAdd.length} slide${toAdd.length === 1 ? "" : "s"}`}
            </button>
            <p className="text-xs text-[var(--color-muted)]">New slides go before the ending slide. They are saved when you click Save changes.</p>
          </>
        )}
      </section>
    </>
  );
}
