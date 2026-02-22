import { useCallback, useEffect, useState } from 'react';

interface UseExplorationMapVisibilityArgs {
  keruHasAspect: boolean;
  isRpgMode: boolean;
  hasSpawnedEnemies: boolean;
}

export function useExplorationMapVisibility({
  keruHasAspect,
  isRpgMode,
  hasSpawnedEnemies,
}: UseExplorationMapVisibilityArgs) {
  const [mapVisible, setMapVisible] = useState(keruHasAspect);
  const [mapOverride, setMapOverride] = useState<boolean | null>(null);

  const autoShouldShowMap = isRpgMode && !hasSpawnedEnemies && keruHasAspect;

  useEffect(() => {
    if (!autoShouldShowMap) {
      if (mapOverride !== null) {
        setMapOverride(null);
      }
      if (mapVisible) {
        setMapVisible(false);
      }
      return;
    }
    if (mapOverride !== null) return;
    if (!mapVisible) {
      setMapVisible(autoShouldShowMap);
    }
  }, [autoShouldShowMap, mapOverride, mapVisible]);

  const handleToggleMap = useCallback(() => {
    setMapVisible((prev) => {
      const next = !prev;
      setMapOverride(next === autoShouldShowMap ? null : next);
      return next;
    });
  }, [autoShouldShowMap]);

  return {
    mapVisible,
    handleToggleMap,
  };
}
