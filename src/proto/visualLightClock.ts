/** One visual clock for pools, halos and airborne scattering. It does not
 * advance game time. Subscribers disappear when flat/hidden/unmounted. */
type Listener = (time: number, frameMs: number) => void;
const listeners = new Set<Listener>();
let request = 0, previous = 0, painted = 0;
const tick = (now: number) => {
  const frameMs = previous ? now - previous : 16.7; previous = now;
  if (now - painted >= 40) { painted = now; listeners.forEach(listener => listener(now, frameMs)); }
  request = listeners.size ? requestAnimationFrame(tick) : 0;
};
export const subscribeVisualLight = (listener: Listener) => {
  listeners.add(listener);
  if (!request) { previous = 0; painted = 0; request = requestAnimationFrame(tick); }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { cancelAnimationFrame(request); request = 0; }
  };
};
