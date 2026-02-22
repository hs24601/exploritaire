import { useState } from 'react';

export function useExplorationEncounterState() {
  const [narrativeOpen, setNarrativeOpen] = useState(true);
  const [explorationMapAlignment, setExplorationMapAlignment] = useState<'player' | 'map'>('player');
  const [pathingLocked, setPathingLocked] = useState(false);
  const [explorationTotalTraversalCount, setExplorationTotalTraversalCount] = useState(0);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [comboPaused, setComboPaused] = useState(false);
  const [waveBattleCount, setWaveBattleCount] = useState(0);
  const [explorationSupplies, setExplorationSupplies] = useState(10);
  const [explorationRowsPerStep, setExplorationRowsPerStep] = useState(1);
  const [tableauSlideOffsetPx, setTableauSlideOffsetPx] = useState(0);
  const [tableauSlideAnimating, setTableauSlideAnimating] = useState(false);
  const [devTraverseHoldProgress, setDevTraverseHoldProgress] = useState(0);

  return {
    narrativeOpen,
    setNarrativeOpen,
    explorationMapAlignment,
    setExplorationMapAlignment,
    pathingLocked,
    setPathingLocked,
    explorationTotalTraversalCount,
    setExplorationTotalTraversalCount,
    ctrlHeld,
    setCtrlHeld,
    comboPaused,
    setComboPaused,
    waveBattleCount,
    setWaveBattleCount,
    explorationSupplies,
    setExplorationSupplies,
    explorationRowsPerStep,
    setExplorationRowsPerStep,
    tableauSlideOffsetPx,
    setTableauSlideOffsetPx,
    tableauSlideAnimating,
    setTableauSlideAnimating,
    devTraverseHoldProgress,
    setDevTraverseHoldProgress,
  };
}
