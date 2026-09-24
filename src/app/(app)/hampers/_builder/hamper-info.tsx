"use client";

import type { Settings } from "@/lib/types";
import type { HamperFields } from "./hamper-state";

/** Name, status, collection and notes. */
export function HamperInfo({
  f,
  set,
  settings,
  canEdit,
}: {
  f: HamperFields;
  set: (key: keyof HamperFields, value: string) => void;
  settings: Settings;
  canEdit: boolean;
}) {
  const collections = Array.from(new Set([...settings.collections, f.collection].filter(Boolean)));

  return (
    <section className="card p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="label" htmlFor="name">
            Hamper name
          </label>
          <input
            id="name"
            className="input mt-1"
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={!canEdit}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            className="select mt-1"
            value={f.status}
            onChange={(e) => set("status", e.target.value)}
            disabled={!canEdit}
          >
            {Array.from(new Set([...settings.hamper_statuses, f.status])).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="collection">
            Collection / occasion
          </label>
          <input
            id="collection"
            list="collections"
            className="input mt-1"
            value={f.collection}
            onChange={(e) => set("collection", e.target.value)}
            disabled={!canEdit}
          />
          <datalist id="collections">
            {collections.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="notes">
            Notes
          </label>
          <input
            id="notes"
            className="input mt-1"
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
            disabled={!canEdit}
          />
        </div>
      </div>
    </section>
  );
}
