import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

interface UseExplorationTraverseHoldControlsArgs {
  enabled: boolean;
  holdDelayMs: number;
  holdIntervalMs: number;
  setHoldProgress: Dispatch<SetStateAction<number>>;
  onTapStepForward: () => void;
  onHoldPulse: () => void;
}

export function useExplorationTraverseHoldControls({
  enabled,
  holdDelayMs,
  holdIntervalMs,
  setHoldProgress,
  onTapStepForward,
  onHoldPulse,
}: UseExplorationTraverseHoldControlsArgs) {
  const holdTimeoutRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const holdStartAtRef = useRef(0);
  const triggeredHoldRef = useRef(false);

  const clearHold = useCallback(() => {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    if (holdRafRef.current !== null) {
      window.cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    holdStartAtRef.current = 0;
    setHoldProgress(0);
  }, [setHoldProgress]);

  const handlePointerDown = useCallback(() => {
    if (!enabled) return;
    clearHold();
    triggeredHoldRef.current = false;
    holdStartAtRef.current = performance.now();
    const tickProgress = () => {
      if (holdStartAtRef.current <= 0) return;
      const elapsed = performance.now() - holdStartAtRef.current;
      const progress = Math.max(0, Math.min(1, elapsed / holdDelayMs));
      setHoldProgress(progress);
      if (progress < 1) {
        holdRafRef.current = window.requestAnimationFrame(tickProgress);
      } else {
        holdRafRef.current = null;
      }
    };
    holdRafRef.current = window.requestAnimationFrame(tickProgress);
    holdTimeoutRef.current = window.setTimeout(() => {
      triggeredHoldRef.current = true;
      setHoldProgress(1);
      onHoldPulse();
      holdIntervalRef.current = window.setInterval(() => {
        onHoldPulse();
      }, holdIntervalMs);
    }, holdDelayMs);
  }, [clearHold, enabled, holdDelayMs, holdIntervalMs, onHoldPulse, setHoldProgress]);

  const handlePointerUp = useCallback(() => {
    clearHold();
  }, [clearHold]);

  const handleClick = useCallback(() => {
    if (triggeredHoldRef.current) {
      triggeredHoldRef.current = false;
      return;
    }
    onTapStepForward();
  }, [onTapStepForward]);

  useEffect(() => () => {
    clearHold();
  }, [clearHold]);

  return {
    handlePointerDown,
    handlePointerUp,
    handleClick,
  };
}
