import { useEffect, useRef } from 'react';

/**
 * Shared press-and-hold affordance for cards with an inspection state.
 * A completed hold consumes the following click so it cannot also trigger the
 * card's normal action (harvest, donate, attach, and so on).
 */
export function useInspectableCard(onInspect: () => void, holdMs = 460) {
  const timerRef = useRef<number | null>(null);
  const inspectedRef = useRef(false);
  const clearHold = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  useEffect(() => () => clearHold(), []);
  return {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      inspectedRef.current = false;
      clearHold();
      timerRef.current = window.setTimeout(() => { timerRef.current = null; inspectedRef.current = true; onInspect(); }, holdMs);
    },
    onPointerUp: clearHold,
    onPointerCancel: clearHold,
    onPointerLeave: clearHold,
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
      if (!inspectedRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      inspectedRef.current = false;
    },
  };
}
