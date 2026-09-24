"use client";

import { useActionState } from "react";
import { deleteProduct } from "../actions";

/** Deletes a product after a confirm. Saved hampers keep their own copy of its line. */
export function DeleteProductButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState(deleteProduct, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete ${label}? Its photos are deleted too. This cannot be undone.`)) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="font-medium text-red-700 hover:underline disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state.error && (
        <span role="alert" className="mt-1 block max-w-[240px] whitespace-normal text-left text-xs text-red-700">
          {state.error}
        </span>
      )}
    </form>
  );
}
