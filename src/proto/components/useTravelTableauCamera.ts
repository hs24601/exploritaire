import { useLayoutEffect, useRef, useState } from 'react';
import { gameTime } from '../../gameTime';
import type { TravelJourney, TravelSegment } from '../travelJourney';
import { tableauApproachProgress, tableauDepartureProgress } from '../tableauTravelCamera';

/** A pause-aware shoulder turn between outgoing and incoming scenery. */
export function useTravelTableauCamera(journey: TravelJourney, segment: TravelSegment | undefined, walked: number) {
  const key = `${journey.path.map(p => `${p.x},${p.y}`).join(';')}:${journey.segments.indexOf(segment!)}`;
  const previous = useRef({ key, segment });
  const paused = useRef(journey.paused); paused.current = journey.paused;
  const [turn, setTurn] = useState<{ from: TravelSegment; to: TravelSegment; progress: number }>();
  useLayoutEffect(() => {
    const from = previous.current.segment;
    const changed = previous.current.key !== key;
    previous.current = { key, segment };
    setTurn(undefined);
    if (!changed || !from || !segment || !(from.kind === 'den-exit' || from.traversalStage === 'exit') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0, elapsed = 0, last = gameTime.now();
    const update = (now: number) => {
      if (!paused.current) elapsed += Math.min(50, now - last);
      last = now;
      const progress = Math.min(1, elapsed / 1100);
      setTurn(progress < 1 ? { from, to: segment, progress } : undefined);
      if (progress < 1) frame = gameTime.requestAnimationFrame(update);
    };
    setTurn({ from, to: segment, progress: 0 });
    frame = gameTime.requestAnimationFrame(update);
    return () => gameTime.cancelAnimationFrame(frame);
  }, [key]);
  const outgoing = !!turn && turn.progress < .5;
  const visible = turn ? outgoing ? turn.from : turn.to : segment;
  const progress = turn ? turn.progress * turn.progress * (3 - 2 * turn.progress) : 0;
  return {
    segment: visible,
    distance: outgoing ? 1 : tableauDepartureProgress(visible, walked) || tableauApproachProgress(visible, walked),
    yaw: turn ? (outgoing ? progress : progress - 1) * Math.PI : 0,
    opacity: turn ? Math.min(1, Math.abs(turn.progress - .5) * 5) : 1,
    turning: !!turn,
  };
}
