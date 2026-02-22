import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { DIRECTIONS, type Direction } from '../components/Compass';

interface UseExplorationNavigationControlsArgs {
  isRpgMode: boolean;
  hasSpawnedEnemies: boolean;
  explorationHeadingRef: MutableRefObject<Direction>;
  setExplorationHeading: Dispatch<SetStateAction<Direction>>;
  setExplorationMapAlignment: Dispatch<SetStateAction<'player' | 'map'>>;
  triggerExplorationTableauSlide: (from: Direction, to: Direction) => void;
}

export function useExplorationNavigationControls({
  isRpgMode,
  hasSpawnedEnemies,
  explorationHeadingRef,
  setExplorationHeading,
  setExplorationMapAlignment,
  triggerExplorationTableauSlide,
}: UseExplorationNavigationControlsArgs) {
  const handleExplorationHeadingChange = useCallback((direction: Direction) => {
    if (isRpgMode && !hasSpawnedEnemies) {
      triggerExplorationTableauSlide(explorationHeadingRef.current, direction);
    }
    setExplorationHeading(direction);
  }, [
    explorationHeadingRef,
    hasSpawnedEnemies,
    isRpgMode,
    setExplorationHeading,
    triggerExplorationTableauSlide,
  ]);

  const handleExplorationHeadingStep = useCallback((clockwise: boolean) => {
    const idx = DIRECTIONS.indexOf(explorationHeadingRef.current);
    if (idx < 0) return;
    const next = DIRECTIONS[(idx + (clockwise ? 1 : -1) + DIRECTIONS.length) % DIRECTIONS.length];
    handleExplorationHeadingChange(next);
  }, [explorationHeadingRef, handleExplorationHeadingChange]);

  const toggleExplorationMapAlignment = useCallback(() => {
    setExplorationMapAlignment((current) => (current === 'map' ? 'player' : 'map'));
  }, [setExplorationMapAlignment]);

  return {
    handleExplorationHeadingChange,
    handleExplorationHeadingStep,
    toggleExplorationMapAlignment,
  };
}
