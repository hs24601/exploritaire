import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Card as CardType } from '../engine/types';
import type { Direction } from '../components/Compass';

type MajorDirection = 'N' | 'E' | 'S' | 'W';
type MinorDirection = 'NE' | 'SE' | 'SW' | 'NW';
type TableauColumnSource =
  | { kind: 'major'; direction: MajorDirection; columnIndex: number }
  | { kind: 'minor-center'; direction: MinorDirection };

interface UseExplorationTableauProgressArgs {
  isRpgMode: boolean;
  hasSpawnedEnemies: boolean;
  explorationHeading: Direction;
  explorationCurrentNodeId: string;
  explorationStepOffsetBySource: Record<string, number>;
  setExplorationStepOffsetBySource: Dispatch<SetStateAction<Record<string, number>>>;
  explorationLastTopCardIdBySourceRef: MutableRefObject<Record<string, string>>;
  tableaus: CardType[][];
  getColumnSourcesForDirection: (direction: Direction) => TableauColumnSource[];
  getExplorationSourceKey: (nodeId: string, source: TableauColumnSource) => string;
}

export function useExplorationTableauProgress({
  isRpgMode,
  hasSpawnedEnemies,
  explorationHeading,
  explorationCurrentNodeId,
  explorationStepOffsetBySource,
  setExplorationStepOffsetBySource,
  explorationLastTopCardIdBySourceRef,
  tableaus,
  getColumnSourcesForDirection,
  getExplorationSourceKey,
}: UseExplorationTableauProgressArgs) {
  const getDisplayedStepIndexForColumn = useCallback((columnIndex: number) => {
    const sources = getColumnSourcesForDirection(explorationHeading);
    const source = sources[columnIndex];
    if (!source) return 1;
    const sourceKey = getExplorationSourceKey(explorationCurrentNodeId, source);
    return (explorationStepOffsetBySource[sourceKey] ?? 0) + 1;
  }, [
    explorationCurrentNodeId,
    explorationHeading,
    explorationStepOffsetBySource,
    getColumnSourcesForDirection,
    getExplorationSourceKey,
  ]);

  const getDebugStepLabelForColumn = useCallback((columnIndex: number) => {
    if (!(isRpgMode && !hasSpawnedEnemies)) return null;
    const sources = getColumnSourcesForDirection(explorationHeading);
    const source = sources[columnIndex];
    if (!source) return null;
    const sourceKey = getExplorationSourceKey(explorationCurrentNodeId, source);
    const step = (explorationStepOffsetBySource[sourceKey] ?? 0) + 1;
    return `${sourceKey} | s:${step}`;
  }, [
    explorationCurrentNodeId,
    explorationHeading,
    explorationStepOffsetBySource,
    getColumnSourcesForDirection,
    getExplorationSourceKey,
    hasSpawnedEnemies,
    isRpgMode,
  ]);

  useEffect(() => {
    if (!(isRpgMode && !hasSpawnedEnemies)) return;
    const sources = getColumnSourcesForDirection(explorationHeading);
    if (sources.length === 0) return;
    const increments: Record<string, number> = {};
    sources.forEach((source, columnIndex) => {
      const sourceKey = getExplorationSourceKey(explorationCurrentNodeId, source);
      const nextTopId = tableaus[columnIndex]?.[tableaus[columnIndex].length - 1]?.id ?? '';
      const prevTopId = explorationLastTopCardIdBySourceRef.current[sourceKey];
      if (prevTopId !== undefined && prevTopId !== nextTopId) {
        increments[sourceKey] = (increments[sourceKey] ?? 0) + 1;
      }
      explorationLastTopCardIdBySourceRef.current[sourceKey] = nextTopId;
    });
    if (Object.keys(increments).length > 0) {
      setExplorationStepOffsetBySource((prev) => {
        const next = { ...prev };
        Object.entries(increments).forEach(([key, value]) => {
          next[key] = (next[key] ?? 0) + value;
        });
        return next;
      });
    }
  }, [
    explorationCurrentNodeId,
    explorationHeading,
    explorationLastTopCardIdBySourceRef,
    getColumnSourcesForDirection,
    getExplorationSourceKey,
    hasSpawnedEnemies,
    isRpgMode,
    setExplorationStepOffsetBySource,
    tableaus,
  ]);

  return {
    getDisplayedStepIndexForColumn,
    getDebugStepLabelForColumn,
  };
}
