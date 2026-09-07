"use client";

import { useActionState } from "react";
import { applyRefresh } from "./actions";

export function ApplyButton({ count }: { count: number }) {
  const [state, action, pending] = useActionState(applyRefresh, {});

  return (
    <form action={action} className="flex items-center gap-3">
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Updating…" : `Update ${count} line${count === 1 ? "" : "s"}`}
      </button>
      {state.error && (
        <span role="alert" className="text-sm text-red-700">
          {state.error}
        </span>
      )}
    </form>
  );
}
