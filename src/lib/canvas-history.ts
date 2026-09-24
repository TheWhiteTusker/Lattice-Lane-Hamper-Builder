/** Undo/redo history for the canvas designer. Re-exported from hamper-canvas.ts. */

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /** Consecutive edits with the same group within GROUP_MS become one step. */
  group: string | null;
  at: number;
};

const HISTORY_LIMIT = 100;
const GROUP_MS = 1000;

export const startHistory = <T>(present: T): History<T> => ({
  past: [],
  present,
  future: [],
  group: null,
  at: 0,
});

/**
 * Record a new present. Pass a group for continuous edits (a slider, a colour
 * picker, typing) so dragging one control is a single undo step, not fifty.
 */
export function record<T>(h: History<T>, next: T, group: string | null, now: number): History<T> {
  if (next === h.present) return h;
  if (group && group === h.group && now - h.at < GROUP_MS) {
    return { ...h, present: next, future: [], at: now };
  }
  return {
    past: [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    group,
    at: now,
  };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
    group: null,
    at: 0,
  };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return {
    past: [...h.past, h.present],
    present: h.future[0],
    future: h.future.slice(1),
    group: null,
    at: 0,
  };
}
