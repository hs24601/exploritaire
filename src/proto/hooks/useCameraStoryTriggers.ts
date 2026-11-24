import { useEffect, useRef } from 'react';
import type { ProtoState } from '../protoState';
import { fireCameraTrigger, stopCameraPlayback } from '../cameraDirector';
export function useCameraStoryTriggers(state: ProtoState, run: number, editing: boolean) {
  const previous = useRef<{ state: ProtoState; run: number; editing: boolean } | null>(null);
  useEffect(() => () => { previous.current = null; }, []);
  useEffect(() => {
    const before = previous.current;
    previous.current = { state, run, editing };
    if (editing) { if (!before?.editing) stopCameraPlayback(); return; }
    if (!before || before.run !== run) { stopCameraPlayback(); fireCameraTrigger('scenario-start', state.dayScenario ?? 'sandbox'); return; }
    if (!before.state.journey && state.journey) fireCameraTrigger('travel-start', state.journey.arrival.biomeId ?? state.journey.segments[state.journey.segments.length - 1]?.tileId ?? '');
    if (before.state.journey && !state.journey) {
      const journey = before.state.journey, actor = state.worldActors.find(a => a.id === journey.actorId), target = journey.path[journey.path.length - 1];
      if (actor && target && (actor.biomeId === journey.arrival.biomeId && actor.location === 'foundation' || Math.hypot(actor.position.x - target.x, actor.position.y - target.y) < 1)) fireCameraTrigger('travel-end', journey.arrival.biomeId ?? journey.segments[journey.segments.length - 1]?.tileId ?? '');
    }
  }, [state, run, editing]);
}
