import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { Direction } from '../components/Compass';

type MajorDirection = 'N' | 'E' | 'S' | 'W';
type DirectionMoveMap = Record<MajorDirection, number>;

interface UseExplorationTravelProgressionArgs {
  explorationHeading: Direction;
  explorationRowsPerStep: number;
  explorationMovesByDirection: DirectionMoveMap;
  explorationAppliedTraversalByDirection: DirectionMoveMap;
  isExplorationMode: boolean;
  setExplorationMovesByDirection: Dispatch<SetStateAction<DirectionMoveMap>>;
  setExplorationAppliedTraversalByDirection: Dispatch<SetStateAction<DirectionMoveMap>>;
  setExplorationTotalTraversalCount: Dispatch<SetStateAction<number>>;
}

export function useExplorationTravelProgression({
  explorationHeading,
  explorationRowsPerStep,
  explorationMovesByDirection,
  explorationAppliedTraversalByDirection,
  isExplorationMode,
  setExplorationMovesByDirection,
  setExplorationAppliedTraversalByDirection,
  setExplorationTotalTraversalCount,
}: UseExplorationTravelProgressionArgs) {
  const activeTravelDirection = (explorationHeading.length === 1 ? explorationHeading : explorationHeading[0]) as MajorDirection;
  const travelRowsPerStep = Math.max(1, explorationRowsPerStep);
  const currentDirectionMoves = explorationMovesByDirection[activeTravelDirection] ?? 0;
  const consumedDirectionRows = (explorationAppliedTraversalByDirection[activeTravelDirection] ?? 0) * travelRowsPerStep;
  const availableExplorationActionPoints = Math.max(0, currentDirectionMoves - consumedDirectionRows);
  const explorationTravelProgress = Math.min(travelRowsPerStep, availableExplorationActionPoints);
  const canStepForwardInExploration = availableExplorationActionPoints >= travelRowsPerStep;

  const awardExplorationActionPoint = useCallback((points = 1) => {
    if (!isExplorationMode) return;
    if (points <= 0) return;
    setExplorationMovesByDirection((prev) => ({
      ...prev,
      [activeTravelDirection]: (prev[activeTravelDirection] ?? 0) + points,
    }));
  }, [activeTravelDirection, isExplorationMode, setExplorationMovesByDirection]);

  const registerExplorationTraversal = useCallback((actionPointRefund = 0) => {
    setExplorationAppliedTraversalByDirection((prev) => ({
      ...prev,
      [activeTravelDirection]: (prev[activeTravelDirection] ?? 0) + 1,
    }));
    if (actionPointRefund > 0) {
      setExplorationMovesByDirection((prev) => ({
        ...prev,
        [activeTravelDirection]: (prev[activeTravelDirection] ?? 0) + actionPointRefund,
      }));
    }
    setExplorationTotalTraversalCount((prev) => prev + 1);
  }, [
    activeTravelDirection,
    setExplorationAppliedTraversalByDirection,
    setExplorationMovesByDirection,
    setExplorationTotalTraversalCount,
  ]);

  return useMemo(() => ({
    travelRowsPerStep,
    availableExplorationActionPoints,
    explorationTravelProgress,
    canStepForwardInExploration,
    awardExplorationActionPoint,
    registerExplorationTraversal,
  }), [
    availableExplorationActionPoints,
    awardExplorationActionPoint,
    canStepForwardInExploration,
    explorationTravelProgress,
    registerExplorationTraversal,
    travelRowsPerStep,
  ]);
}
