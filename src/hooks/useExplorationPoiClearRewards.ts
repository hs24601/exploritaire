import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { PoiReward } from '../engine/worldMapTypes';
import type { ExplorationMapNode } from '../components/ExplorationMap';

interface UseExplorationPoiClearRewardsArgs {
  explorationCurrentNodeId: string;
  explorationNodes: ExplorationMapNode[];
  tableaus: Array<Array<{ id: string }>>;
  actorKeruArchetype: string | null | undefined;
  isCurrentExplorationTableauCleared: boolean;
  getExplorationNodeCoordinates: (nodeId: string) => { x: number; y: number } | null;
  getPoiRewardsForKey: (key: string) => PoiReward[];
  getPoiIdForKey: (key: string) => string | null;
  lastPoiRewardKey: string | null;
  consumedPoiRewardKeysRef: MutableRefObject<Set<string>>;
  setLastPoiRewardKey: Dispatch<SetStateAction<string | null>>;
  setPendingPoiRewardKey: Dispatch<SetStateAction<string | null>>;
  setShowKeruArchetypeReward: Dispatch<SetStateAction<boolean>>;
  puzzleCompleted?: (payload?: { coord?: { x: number; y: number } | null; poiId?: string | null; tableauId?: string | null } | null) => void;
}

export function useExplorationPoiClearRewards({
  explorationCurrentNodeId,
  explorationNodes,
  tableaus,
  actorKeruArchetype,
  isCurrentExplorationTableauCleared,
  getExplorationNodeCoordinates,
  getPoiRewardsForKey,
  getPoiIdForKey,
  lastPoiRewardKey,
  consumedPoiRewardKeysRef,
  setLastPoiRewardKey,
  setPendingPoiRewardKey,
  setShowKeruArchetypeReward,
  puzzleCompleted,
}: UseExplorationPoiClearRewardsArgs) {
  const clearedPoiKeyRef = useRef<Set<string>>(new Set());
  const seenNonEmptyTableauKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const nextCleared = new Set(clearedPoiKeyRef.current);
    let newlyClearedAspectKey: string | null = null;
    const currentCoords = getExplorationNodeCoordinates(explorationCurrentNodeId);
    const currentTableauHasCards = tableaus.some((tableau) => tableau.length > 0);

    if (currentCoords) {
      const key = `${currentCoords.x},${currentCoords.y}`;
      if (currentTableauHasCards) {
        seenNonEmptyTableauKeysRef.current.add(key);
      }
      const hasSeenCards = seenNonEmptyTableauKeysRef.current.has(key);
      if (hasSeenCards && isCurrentExplorationTableauCleared && tableaus.length > 0 && !nextCleared.has(key)) {
        nextCleared.add(key);
        puzzleCompleted?.({
          coord: { x: currentCoords.x, y: currentCoords.y },
          poiId: getPoiIdForKey(key),
          tableauId: explorationCurrentNodeId,
        });
        const rewards = getPoiRewardsForKey(key);
        const clearRewards = rewards.filter((reward) => (reward.trigger ?? 'on_tableau_clear') === 'on_tableau_clear');
        if (clearRewards.length > 0 && !consumedPoiRewardKeysRef.current.has(key)) {
          newlyClearedAspectKey = key;
          setLastPoiRewardKey(key);
          const reward = clearRewards[0];
          const isAspectReward = reward.type === 'aspect-choice' || reward.type === 'aspect-jumbo';
          if (!isAspectReward || (actorKeruArchetype ?? 'blank') === 'blank') {
            setPendingPoiRewardKey(key);
            setShowKeruArchetypeReward(true);
          }
        }
      }
    }

    explorationNodes.forEach((node) => {
      if (!node.cleared) return;
      const key = `${node.x},${node.y}`;
      if (nextCleared.has(key)) return;
      nextCleared.add(key);
      puzzleCompleted?.({
        coord: { x: node.x, y: node.y },
        poiId: getPoiIdForKey(key),
        tableauId: node.id,
      });
    });

    if (newlyClearedAspectKey && newlyClearedAspectKey !== lastPoiRewardKey) {
      setLastPoiRewardKey(newlyClearedAspectKey);
    }
    clearedPoiKeyRef.current = nextCleared;
  }, [
    actorKeruArchetype,
    consumedPoiRewardKeysRef,
    explorationCurrentNodeId,
    explorationNodes,
    getExplorationNodeCoordinates,
    getPoiIdForKey,
    getPoiRewardsForKey,
    isCurrentExplorationTableauCleared,
    lastPoiRewardKey,
    puzzleCompleted,
    setLastPoiRewardKey,
    setPendingPoiRewardKey,
    setShowKeruArchetypeReward,
    tableaus,
  ]);
}
