"use client";

import type { ActionState } from "@/lib/forms";

export function Status({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <span role="alert" className="text-sm text-red-700">
        {state.error}
      </span>
    );
  return null;
}
