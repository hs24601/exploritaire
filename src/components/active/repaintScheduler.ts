/**
 * Shared RAF loop for all ContinualRepaintEffect canvases.
 *
 * One requestAnimationFrame tick drives every registered painter.
 * A fixed GLOBAL_BUDGET of fill operations is distributed proportionally
 * by each canvas's weight, so registering N canvases costs the same as
 * registering one — they split the budget rather than each owning a full loop.
 */

const GLOBAL_BUDGET = 1500; // total fillRect calls per animation frame

type Painter = {
  getWeight: () => number;
  paintN: (n: number) => void;
};

const painters = new Map<symbol, Painter>();
let rafId = 0;

const tick = () => {
  if (painters.size === 0) { rafId = 0; return; }

  let totalWeight = 0;
  for (const p of painters.values()) totalWeight += p.getWeight();
  if (totalWeight <= 0) totalWeight = 1;

  for (const p of painters.values()) {
    const n = Math.max(1, Math.round((p.getWeight() / totalWeight) * GLOBAL_BUDGET));
    p.paintN(n);
  }

  rafId = requestAnimationFrame(tick);
};

/**
 * Register a canvas painter with the shared loop.
 *
 * @param getWeight  Returns this canvas's relative stroke priority.
 *                   Use `countPerFrame * velocity` to match the standalone behaviour.
 * @param paintN     Called each frame with the number of strokes to apply.
 * @returns          Cleanup — call on unmount to deregister.
 */
export function scheduleRepaint(
  getWeight: () => number,
  paintN: (n: number) => void,
): () => void {
  const key = Symbol();
  painters.set(key, { getWeight, paintN });
  if (!rafId) rafId = requestAnimationFrame(tick);
  return () => {
    painters.delete(key);
    if (painters.size === 0 && rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  };
}
