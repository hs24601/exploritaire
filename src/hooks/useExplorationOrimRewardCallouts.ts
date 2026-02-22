import { useEffect, type Dispatch, type SetStateAction } from 'react';

interface OrimRewardCallout {
  id: number;
  orimId: string;
  foundationIndex: number | null;
  dropPoint?: { x: number; y: number } | null;
}

interface UseExplorationOrimRewardCalloutsArgs {
  lastResolvedOrimId: string | null | undefined;
  lastResolvedOrimFoundationIndex: number | null | undefined;
  lastResolvedOrimDropPoint: { x: number; y: number } | null | undefined;
  hasOrimDefinition: (orimId: string) => boolean;
  setOrimRewardCallouts: Dispatch<SetStateAction<OrimRewardCallout[]>>;
  processRelicCombatEvent?: (event: { type: 'ORIM_CALLOUT_SHOWN' }) => void;
}

export function useExplorationOrimRewardCallouts({
  lastResolvedOrimId,
  lastResolvedOrimFoundationIndex,
  lastResolvedOrimDropPoint,
  hasOrimDefinition,
  setOrimRewardCallouts,
  processRelicCombatEvent,
}: UseExplorationOrimRewardCalloutsArgs) {
  useEffect(() => {
    const orimId = lastResolvedOrimId;
    if (!orimId) return;

    if (hasOrimDefinition(orimId)) {
      const calloutId = Date.now() + Math.random();
      const foundationIndex = lastResolvedOrimFoundationIndex ?? null;
      const dropPoint = lastResolvedOrimDropPoint ?? null;
      setOrimRewardCallouts((prev) => [...prev, { id: calloutId, orimId, foundationIndex, dropPoint }]);
      window.setTimeout(() => {
        setOrimRewardCallouts((prev) => prev.filter((entry) => entry.id !== calloutId));
      }, 3500);
    }

    processRelicCombatEvent?.({ type: 'ORIM_CALLOUT_SHOWN' });
  }, [
    hasOrimDefinition,
    lastResolvedOrimDropPoint,
    lastResolvedOrimFoundationIndex,
    lastResolvedOrimId,
    processRelicCombatEvent,
    setOrimRewardCallouts,
  ]);
}
