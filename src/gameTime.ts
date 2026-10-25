/** Simulation scheduling shares one clock. Native browser/UI clocks remain untouched. */
export function createGameClock(host: {
  now: () => number;
  frame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
  timer: (callback: () => void, delay: number) => number;
  cancelTimer: (id: number) => void;
}) {
  // `chosen` is the player's pause; holds are internal (a covering loader) and
  // survive anything that resets the player's choice.
  let paused = false, chosen = false, holds = 0, stoppedAt = 0, offset = 0, nextId = 1;
  const frames = new Map<number, { callback: FrameRequestCallback; native?: number }>();
  const timers = new Map<number, { callback: () => void; due: number; interval?: number; native?: number }>();
  const listeners = new Set<() => void>();
  const now = () => (paused ? stoppedAt : host.now()) - offset;
  const armFrame = (id: number) => {
    const task = frames.get(id); if (!task || paused) return;
    task.native = host.frame(() => { if (!frames.delete(id)) return; task.callback(now()); });
  };
  const armTimer = (id: number) => {
    const task = timers.get(id); if (!task || paused) return;
    task.native = host.timer(() => {
      if (!timers.has(id)) return;
      if (task.interval === undefined) timers.delete(id);
      else task.due = now() + task.interval;
      task.callback();
      if (task.interval !== undefined) armTimer(id);
    }, Math.max(0, task.due - now()));
  };
  const cancelAnimationFrame = (id: number) => { const task = frames.get(id); if (task?.native !== undefined) host.cancelFrame(task.native); frames.delete(id); };
  const clearTimeout = (id?: number) => { if (id === undefined) return; const task = timers.get(id); if (task?.native !== undefined) host.cancelTimer(task.native); timers.delete(id); };
  const schedule = (callback: () => void, delay = 0, interval?: number) => { const id = nextId++; timers.set(id, { callback, due: now() + Math.max(0, delay), interval }); armTimer(id); return id; };
  return {
    now,
    isPaused: () => paused,
    isPlayerPaused: () => chosen,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    setPaused(value: boolean) { chosen = value; apply(); },
    /** Stop the clock until the returned release runs, without changing the player's pause. */
    hold() {
      holds++; apply();
      let released = false;
      return () => { if (released) return; released = true; holds--; apply(); };
    },
    requestAnimationFrame(callback: FrameRequestCallback) { const id = nextId++; frames.set(id, { callback }); armFrame(id); return id; },
    cancelAnimationFrame,
    setTimeout: (callback: () => void, delay?: number) => schedule(callback, delay),
    clearTimeout,
    setInterval: (callback: () => void, delay = 0) => schedule(callback, delay, Math.max(1, delay)),
    clearInterval: clearTimeout,
  };
  function apply() {
    const value = chosen || holds > 0;
    if (value === paused) return;
    if (value) {
      stoppedAt = host.now(); paused = true;
      frames.forEach(task => { if (task.native !== undefined) host.cancelFrame(task.native); });
      timers.forEach(task => { if (task.native !== undefined) host.cancelTimer(task.native); });
    } else {
      offset += host.now() - stoppedAt; paused = false;
      frames.forEach((_, id) => armFrame(id)); timers.forEach((_, id) => armTimer(id));
    }
    listeners.forEach(fn => fn());
  }
}
export const gameTime = createGameClock({
  now: () => performance.now(),
  frame: callback => globalThis.requestAnimationFrame(callback),
  cancelFrame: id => globalThis.cancelAnimationFrame(id),
  timer: (callback, delay) => globalThis.setTimeout(callback, delay),
  cancelTimer: id => globalThis.clearTimeout(id),
});
