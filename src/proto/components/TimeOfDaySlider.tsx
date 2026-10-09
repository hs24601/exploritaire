import { startTransition, useEffect, useRef } from 'react';

/** How often a drag re-lights the table. Each new hour re-renders and re-lights
 * the whole table, which costs more than a drag step. */
const RELIGHT_INTERVAL_MS = 120;

/** The table's time-of-day slider. The thumb is left to the browser (an
 * uncontrolled input) so React never writes a stale hour back into it
 * mid-drag, and the table catches up at most every RELIGHT_INTERVAL_MS as an
 * interruptible transition. Re-lighting on every input event made slow renders
 * snap the thumb back to earlier hours while dragging. */
export function TimeOfDaySlider({ hours, onChange }: { hours: number; onChange: (hours: number) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);
  const pending = useRef<number | null>(null);
  const timer = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Follow outside changes (the day/night cycle, a new day) except mid-drag.
  useEffect(() => {
    if (!dragging.current && pending.current === null && input.current) input.current.value = String(hours);
  }, [hours]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const flush = () => {
    window.clearTimeout(timer.current);
    timer.current = 0;
    const next = pending.current;
    pending.current = null;
    if (next !== null) startTransition(() => onChangeRef.current(next));
  };
  const release = () => { dragging.current = false; flush(); };
  return (
    <input
      aria-label="Table time of day"
      type="range"
      min="0"
      max="23.99"
      step="0.05"
      ref={input}
      defaultValue={hours}
      onPointerDown={() => { dragging.current = true; }}
      onPointerUp={release}
      onPointerCancel={release}
      onBlur={release}
      onChange={(event) => {
        const next = Number(event.target.value);
        pending.current = next;
        if (!dragging.current) flush();
        else if (!timer.current) timer.current = window.setTimeout(flush, RELIGHT_INTERVAL_MS);
      }}
    />
  );
}
