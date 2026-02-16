/**
 * Shared RAF coordinator for drag interactions.
 *
 * Consolidates the DragPreview visual loop and the useDragDrop React-state
 * flush loop onto a single requestAnimationFrame tick so both systems read
 * from the same display frame instead of firing independently.
 *
 * API:
 *   subscribeDragRaf(fn)    – continuous subscription; fires fn every frame
 *                             until the returned unsubscribe() is called.
 *   scheduleDragRafOnce(fn) – one-shot; fn fires on the next tick then
 *                             auto-unsubscribes. Returns a cancel function.
 */

type TickCallback = (time: number) => void;

const subscribers = new Set<TickCallback>();
let rafHandle: number | null = null;

function loop(time: number): void {
  rafHandle = null;
  // Snapshot before iteration — callbacks may modify the set (scheduleDragRafOnce).
  const cbs = Array.from(subscribers);
  for (const cb of cbs) cb(time);
  if (subscribers.size > 0) {
    rafHandle = requestAnimationFrame(loop);
  }
}

/** Subscribe to every RAF tick while dragging. Returns an unsubscribe fn. */
export function subscribeDragRaf(callback: TickCallback): () => void {
  subscribers.add(callback);
  if (rafHandle === null) {
    rafHandle = requestAnimationFrame(loop);
  }
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && rafHandle !== null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  };
}

/** Schedule a one-shot callback on the next shared RAF tick. Returns a cancel fn. */
export function scheduleDragRafOnce(callback: TickCallback): () => void {
  let fired = false;
  const wrapped: TickCallback = (time) => {
    if (fired) return;
    fired = true;
    subscribers.delete(wrapped);
    callback(time);
  };
  return subscribeDragRaf(wrapped);
}
