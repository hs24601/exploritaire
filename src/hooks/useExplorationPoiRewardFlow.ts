import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Card } from '../engine/types';
import type { PoiReward } from '../engine/worldMapTypes';

interface UseExplorationPoiRewardFlowArgs {
  isRpgMode: boolean;
  enemyFoundations: Card[][];
  explorationNodes: Array<{ x: number; y: number; cleared?: boolean }>;
  actorKeruArchetype: string | null | undefined;
  pendingPoiRewardKey: string | null;
  lastPoiRewardKey: string | null;
  poiRewardResolvedAt?: number;
  getPoiRewardsForKey: (key: string) => PoiReward[];
  consumedPoiRewardKeysRef: MutableRefObject<Set<string>>;
  keruAbilityRewardShownRef: MutableRefObject<boolean>;
  setShowKeruArchetypeReward: Dispatch<SetStateAction<boolean>>;
  setShowKeruAbilityReward: Dispatch<SetStateAction<boolean>>;
  setPendingPoiRewardKey: Dispatch<SetStateAction<string | null>>;
  setLastPoiRewardKey: Dispatch<SetStateAction<string | null>>;
}

export function useExplorationPoiRewardFlow({
  isRpgMode,
  enemyFoundations,
  explorationNodes,
  actorKeruArchetype,
  pendingPoiRewardKey,
  lastPoiRewardKey,
  poiRewardResolvedAt,
  getPoiRewardsForKey,
  consumedPoiRewardKeysRef,
  keruAbilityRewardShownRef,
  setShowKeruArchetypeReward,
  setShowKeruAbilityReward,
  setPendingPoiRewardKey,
  setLastPoiRewardKey,
}: UseExplorationPoiRewardFlowArgs) {
  useEffect(() => {
    const spawnedEnemies = enemyFoundations.some((foundation) => foundation.length > 0);
    if (!isRpgMode || spawnedEnemies) {
      setShowKeruArchetypeReward(false);
      setPendingPoiRewardKey(null);
      return;
    }
    if (pendingPoiRewardKey) return;
    const keruArchetype = actorKeruArchetype ?? 'blank';
    const clearedPoiRewardKey = lastPoiRewardKey;
    if (!clearedPoiRewardKey) return;
    const reward = getPoiRewardsForKey(clearedPoiRewardKey)[0];
    if (!reward) return;
    const isAspectReward = reward.type === 'aspect-choice' || reward.type === 'aspect-jumbo';
    if (isAspectReward && keruArchetype !== 'blank') {
      setShowKeruArchetypeReward(false);
      setPendingPoiRewardKey(null);
      return;
    }
    setPendingPoiRewardKey(clearedPoiRewardKey);
    setShowKeruArchetypeReward(true);
  }, [
    actorKeruArchetype,
    enemyFoundations,
    getPoiRewardsForKey,
    isRpgMode,
    lastPoiRewardKey,
    pendingPoiRewardKey,
    setPendingPoiRewardKey,
    setShowKeruArchetypeReward,
  ]);

  useEffect(() => {
    if (!isRpgMode) return;
    const keruArchetype = actorKeruArchetype ?? 'blank';
    const tutorialBCleared = explorationNodes.some((node) => node.x === 0 && node.y === 1 && node.cleared);
    if (pendingPoiRewardKey) {
      const reward = getPoiRewardsForKey(pendingPoiRewardKey)[0];
      if (reward?.type === 'orim-choice') return;
    }
    if (tutorialBCleared && keruArchetype !== 'blank' && !keruAbilityRewardShownRef.current) {
      setShowKeruAbilityReward(true);
      keruAbilityRewardShownRef.current = true;
    }
  }, [
    actorKeruArchetype,
    explorationNodes,
    getPoiRewardsForKey,
    isRpgMode,
    pendingPoiRewardKey,
    keruAbilityRewardShownRef,
    setShowKeruAbilityReward,
  ]);

  useEffect(() => {
    if (!poiRewardResolvedAt || !pendingPoiRewardKey) return;
    const reward = getPoiRewardsForKey(pendingPoiRewardKey)[0];
    if (!reward) return;
    if (reward.type === 'orim-choice') {
      consumedPoiRewardKeysRef.current.add(pendingPoiRewardKey);
      setLastPoiRewardKey(null);
      setShowKeruArchetypeReward(false);
      setPendingPoiRewardKey(null);
      keruAbilityRewardShownRef.current = true;
    }
  }, [
    consumedPoiRewardKeysRef,
    getPoiRewardsForKey,
    pendingPoiRewardKey,
    poiRewardResolvedAt,
    keruAbilityRewardShownRef,
    setLastPoiRewardKey,
    setPendingPoiRewardKey,
    setShowKeruArchetypeReward,
  ]);
}
