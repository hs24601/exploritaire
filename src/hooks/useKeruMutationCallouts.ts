import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ActorKeru } from '../engine/types';

interface KeruAttributeCallout {
  id: number;
  text: string;
}

interface UseKeruMutationCalloutsArgs {
  actorKeru: ActorKeru | undefined;
  keruCalloutDurationMs: number;
  getKeruAspectAttributeLines: (archetype?: ActorKeru['archetype'] | null) => string[];
  keruAbilityTimeoutsRef: MutableRefObject<number[]>;
  prevKeruMutationAtRef: MutableRefObject<number | undefined>;
  setShowKeruArchetypeReward: Dispatch<SetStateAction<boolean>>;
  setKeruFxToken: Dispatch<SetStateAction<number>>;
  setKeruFxActive: Dispatch<SetStateAction<boolean>>;
  setKeruStatLines: Dispatch<SetStateAction<string[]>>;
  setKeruAttributeCallouts: Dispatch<SetStateAction<KeruAttributeCallout[]>>;
}

export function useKeruMutationCallouts({
  actorKeru,
  keruCalloutDurationMs,
  getKeruAspectAttributeLines,
  keruAbilityTimeoutsRef,
  prevKeruMutationAtRef,
  setShowKeruArchetypeReward,
  setKeruFxToken,
  setKeruFxActive,
  setKeruStatLines,
  setKeruAttributeCallouts,
}: UseKeruMutationCalloutsArgs) {
  useEffect(() => {
    const currentKeru = actorKeru;
    const lastMutationAt = currentKeru?.lastMutationAt;
    const prevMutationAt = prevKeruMutationAtRef.current;
    let timeout: number | undefined;
    keruAbilityTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    keruAbilityTimeoutsRef.current = [];
    setKeruAttributeCallouts([]);

    if (!lastMutationAt) {
      setKeruFxActive(false);
      setKeruStatLines([]);
    } else if (lastMutationAt !== prevMutationAt && currentKeru) {
      setShowKeruArchetypeReward(false);
      setKeruFxToken(lastMutationAt);
      setKeruFxActive(true);
      const attributeLines = getKeruAspectAttributeLines(currentKeru.archetype);
      setKeruStatLines(attributeLines);
      attributeLines.forEach((line, index) => {
        const delay = index * 500;
        const showId = window.setTimeout(() => {
          setKeruAttributeCallouts((prev) => [...prev, { id: lastMutationAt + index, text: line }]);
        }, delay);
        const hideId = window.setTimeout(() => {
          setKeruAttributeCallouts((prev) => prev.filter((entry) => entry.id !== lastMutationAt + index));
        }, delay + 3200);
        keruAbilityTimeoutsRef.current.push(showId, hideId);
      });
      timeout = window.setTimeout(() => {
        setKeruFxActive(false);
      }, keruCalloutDurationMs);
    }

    prevKeruMutationAtRef.current = lastMutationAt;

    return () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }
    };
  }, [
    actorKeru,
    getKeruAspectAttributeLines,
    keruAbilityTimeoutsRef,
    keruCalloutDurationMs,
    prevKeruMutationAtRef,
    setKeruAttributeCallouts,
    setKeruFxActive,
    setKeruFxToken,
    setKeruStatLines,
    setShowKeruArchetypeReward,
  ]);
}
