"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createPresentation, type DeckItem } from "../actions";
import { ItemPicker, type PickerData } from "../item-picker";

export function PresentationForm({ hampers, products, defaultContact }: PickerData & { defaultContact: string }) {
  const [state, action, pending] = useActionState(createPresentation, {});
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [closingTitle, setClosingTitle] = useState("Thank you");
  const [closingText, setClosingText] = useState(defaultContact);
  const [items, setItems] = useState<DeckItem[]>([]);

  const payload = JSON.stringify({ title, subtitle, closingTitle, closingText, items });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold">Entry slide</h2>
          <div>
            <label className="label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className="input mt-1"
              placeholder="e.g. Diwali gifting for Acme Corp"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="subtitle">
              Subtitle
            </label>
            <input
              id="subtitle"
              className="input mt-1"
              placeholder="e.g. Curated hampers · October 2026"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold">Ending slide</h2>
          <div>
            <label className="label" htmlFor="closingTitle">
              Heading
            </label>
            <input id="closingTitle" className="input mt-1" value={closingTitle} onChange={(e) => setClosingTitle(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="closingText">
              Contact details
            </label>
            <textarea
              id="closingText"
              rows={3}
              className="input mt-1"
              value={closingText}
              onChange={(e) => setClosingText(e.target.value)}
            />
          </div>
        </section>
      </div>

      <ItemPicker hampers={hampers} products={products} value={items} onChange={setItems} />

      {state.error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-primary" disabled={pending || !items.length || !title.trim()}>
          {pending ? "Creating…" : `Create presentation (${items.length + 2} slides)`}
        </button>
        <Link href="/presentations" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
