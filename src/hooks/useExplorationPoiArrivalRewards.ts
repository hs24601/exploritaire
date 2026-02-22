import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { PoiReward } from '../engine/worldMapTypes';

interface UseExplorationPoiArrivalRewardsArgs {
  explorationCurrentNodeId: string;
  getExplorationNodeCoordinates: (nodeId: string) => { x: number; y: number } | null;
  getPoiRewardsForKey: (key: string) => PoiReward[];
  lastPoiRewardKey: string | null;
  setLastPoiRewardKey: Dispatch<SetStateAction<string | null>>;
}

export function useExplorationPoiArrivalRewards({
  explorationCurrentNodeId,
  getExplorationNodeCoordinates,
  getPoiRewardsForKey,
  lastPoiRewardKey,
  setLastPoiRewardKey,
}: UseExplorationPoiArrivalRewardsArgs) {
  const visitedPoiKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentCoords = getExplorationNodeCoordinates(explorationCurrentNodeId);
    if (!currentCoords) return;
    const key = `${currentCoords.x},${currentCoords.y}`;
    if (visitedPoiKeysRef.current.has(key)) return;
    visitedPoiKeysRef.current.add(key);

    const rewards = getPoiRewardsForKey(key);
    const hasArrivalReward = rewards.some((reward) => reward.trigger === 'on_arrival');
    if (hasArrivalReward && key !== lastPoiRewardKey) {
      setLastPoiRewardKey(key);
    }
  }, [
    explorationCurrentNodeId,
    getExplorationNodeCoordinates,
    getPoiRewardsForKey,
    lastPoiRewardKey,
    setLastPoiRewardKey,
  ]);
}
