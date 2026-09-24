"use client";

import { useState } from "react";
import { lookupGstin } from "../../clients/actions";
import { Field } from "./fields";

/** GSTIN with "Fetch details", which fills the client name and billing address from the GST register. */
export function GstinField({
  value,
  canEdit,
  onChange,
  onFound,
}: {
  value: string;
  canEdit: boolean;
  onChange: (gstin: string) => void;
  onFound: (details: { name?: string; billing_address?: string }) => void;
}) {
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  async function fetchDetails() {
    const gstin = value.trim().toUpperCase();
    if (gstin.length !== 15) return;
    setFetching(true);
    setError("");
    try {
      const res = await lookupGstin(gstin);
      if (res.error) setError(res.error);
      else if (res.details) onFound(res.details);
    } catch {
      setError("Could not reach GST lookup service.");
    } finally {
      setFetching(false);
    }
  }

  return (
    <Field label="GSTIN" htmlFor="gstin">
      <div className="mt-1 flex gap-2">
        <input
          id="gstin"
          className="input font-mono uppercase"
          value={value}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase());
            if (error) setError("");
          }}
          disabled={!canEdit}
          maxLength={15}
          placeholder="29AAECB4326R1Z5"
        />
        {canEdit && (
          <button
            type="button"
            onClick={fetchDetails}
            disabled={fetching || value.trim().length !== 15}
            className="btn-secondary whitespace-nowrap text-xs px-3"
          >
            {fetching ? "Fetching…" : "Fetch details"}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-amber-700">{error}</p>}
    </Field>
  );
}
