import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Card as CardType } from '../engine/types';
import type { Direction } from '../components/Compass';
import type { ExplorationMapEdge, ExplorationMapNode } from '../components/ExplorationMap';

type MajorDirection = 'N' | 'E' | 'S' | 'W';
type DirectionMoveMap = Record<MajorDirection, number>;

interface UseExplorationBootstrapStateArgs {
  isRpgMode: boolean;
  hasSpawnedEnemies: boolean;
  biomeKey: string | null | undefined;
  explorationSpawnX: number;
  explorationSpawnY: number;
  setExplorationNodes: Dispatch<SetStateAction<ExplorationMapNode[]>>;
  setExplorationEdges: Dispatch<SetStateAction<ExplorationMapEdge[]>>;
  setExplorationCurrentNodeId: Dispatch<SetStateAction<string>>;
  setExplorationTrailNodeIds: Dispatch<SetStateAction<string[]>>;
  setExplorationHeading: Dispatch<SetStateAction<Direction>>;
  setExplorationStepOffsetBySource: Dispatch<SetStateAction<Record<string, number>>>;
  setExplorationMovesByDirection: Dispatch<SetStateAction<DirectionMoveMap>>;
  setExplorationAppliedTraversalByDirection: Dispatch<SetStateAction<DirectionMoveMap>>;
  setExplorationTotalTraversalCount: Dispatch<SetStateAction<number>>;
  explorationNodesRef: MutableRefObject<ExplorationMapNode[]>;
  explorationEdgesRef: MutableRefObject<ExplorationMapEdge[]>;
  explorationCurrentNodeIdRef: MutableRefObject<string>;
  explorationTrailNodeIdsRef: MutableRefObject<string[]>;
  explorationHeadingRef: MutableRefObject<Direction>;
  explorationLastTopCardIdBySourceRef: MutableRefObject<Record<string, string>>;
  explorationDisplayedContextRef: MutableRefObject<{ nodeId: string; heading: Direction } | null>;
  explorationMajorTableauCacheRef: MutableRefObject<Record<string, CardType[][]>>;
  explorationMinorCenterCacheRef: MutableRefObject<Record<string, CardType[]>>;
  explorationPoiTableauCacheRef: MutableRefObject<Record<string, CardType[][]>>;
}

const EMPTY_DIRECTION_MOVES: DirectionMoveMap = {
  N: 0,
  E: 0,
  S: 0,
  W: 0,
};

export function useExplorationBootstrapState({
  isRpgMode,
  hasSpawnedEnemies,
  biomeKey,
  explorationSpawnX,
  explorationSpawnY,
  setExplorationNodes,
  setExplorationEdges,
  setExplorationCurrentNodeId,
  setExplorationTrailNodeIds,
  setExplorationHeading,
  setExplorationStepOffsetBySource,
  setExplorationMovesByDirection,
  setExplorationAppliedTraversalByDirection,
  setExplorationTotalTraversalCount,
  explorationNodesRef,
  explorationEdgesRef,
  explorationCurrentNodeIdRef,
  explorationTrailNodeIdsRef,
  explorationHeadingRef,
  explorationLastTopCardIdBySourceRef,
  explorationDisplayedContextRef,
  explorationMajorTableauCacheRef,
  explorationMinorCenterCacheRef,
  explorationPoiTableauCacheRef,
}: UseExplorationBootstrapStateArgs) {
  useEffect(() => {
    if (!(isRpgMode && !hasSpawnedEnemies)) return;
    const originNode: ExplorationMapNode = {
      id: 'origin',
      heading: 'N',
      x: explorationSpawnX,
      y: explorationSpawnY,
      z: 0,
      visits: 1,
    };
    setExplorationNodes([originNode]);
    explorationNodesRef.current = [originNode];
    setExplorationEdges([]);
    explorationEdgesRef.current = [];
    setExplorationCurrentNodeId('origin');
    explorationCurrentNodeIdRef.current = 'origin';
    setExplorationTrailNodeIds(['origin']);
    explorationTrailNodeIdsRef.current = ['origin'];
    setExplorationHeading('N');
    explorationHeadingRef.current = 'N';
    setExplorationStepOffsetBySource({});
    setExplorationMovesByDirection(EMPTY_DIRECTION_MOVES);
    setExplorationAppliedTraversalByDirection(EMPTY_DIRECTION_MOVES);
    setExplorationTotalTraversalCount(0);
    explorationLastTopCardIdBySourceRef.current = {};
    explorationDisplayedContextRef.current = null;
    explorationMajorTableauCacheRef.current = {};
    explorationMinorCenterCacheRef.current = {};
    explorationPoiTableauCacheRef.current = {};
  }, [
    biomeKey,
    explorationCurrentNodeIdRef,
    explorationDisplayedContextRef,
    explorationEdgesRef,
    explorationHeadingRef,
    explorationLastTopCardIdBySourceRef,
    explorationMajorTableauCacheRef,
    explorationMinorCenterCacheRef,
    explorationNodesRef,
    explorationPoiTableauCacheRef,
    explorationSpawnX,
    explorationSpawnY,
    explorationTrailNodeIdsRef,
    hasSpawnedEnemies,
    isRpgMode,
    setExplorationAppliedTraversalByDirection,
    setExplorationCurrentNodeId,
    setExplorationEdges,
    setExplorationHeading,
    setExplorationMovesByDirection,
    setExplorationNodes,
    setExplorationStepOffsetBySource,
    setExplorationTotalTraversalCount,
    setExplorationTrailNodeIds,
  ]);
}
