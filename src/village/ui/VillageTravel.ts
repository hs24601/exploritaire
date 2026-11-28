import { useEffect, useState } from 'react';
import type { TokenKin } from '../rules/aspen';
import { tileAt } from '../rules/map';

export interface VillageJourney {
  route: number[];
  members: TokenKin[];
  start: number;
  duration: number;
}

export function useTravelFrame(journey: VillageJourney | null) {
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!journey) return;
    let frame = 0;
    let last = -Infinity;
    const tick = (now: number) => {
      if (now - last >= 30) {
        last = now;
        redraw(n => n + 1);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [journey]);
  if (!journey) return null;
  const elapsed = Math.max(0, performance.now() - journey.start);
  const steps = journey.route.length - 1;
  const progress = Math.min(steps, elapsed / journey.duration * steps);
  const segment = Math.min(steps - 1, Math.floor(progress));
  const fraction = progress - segment;
  const from = tileAt(journey.route[segment]), to = tileAt(journey.route[segment + 1]);
  return { ...journey, elapsed, from, to, fraction, segment,
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction };
}

export type TravelFrame = ReturnType<typeof useTravelFrame>;
