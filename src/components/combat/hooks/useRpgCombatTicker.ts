import { useEffect, useRef } from 'react';
import type { RpgTickAction } from '../contracts';

interface UseRpgCombatTickerOptions {
  enabled: boolean;
  paused: boolean;
  timeScale: number;
  tickAction?: RpgTickAction;
  intervalMs?: number;
  minTimeScale?: number;
  onTickDurationMs?: (durationMs: number) => void;
  resetClockDeps?: ReadonlyArray<unknown>;
}

export function useRpgCombatTicker({
  enabled,
  paused,
  timeScale,
  tickAction,
  intervalMs = 50,
  minTimeScale = 0.1,
  onTickDurationMs,
  resetClockDeps = [],
}: UseRpgCombatTickerOptions) {
  const tickActionRef = useRef<RpgTickAction | undefined>(tickAction);
  const scaledClockRef = useRef<number>(Date.now());
  const lastRealNowRef = useRef<number>(performance.now());

  useEffect(() => {
    tickActionRef.current = tickAction;
  }, [tickAction]);

  useEffect(() => {
    lastRealNowRef.current = performance.now();
    scaledClockRef.current = Date.now();
  }, resetClockDeps);

  useEffect(() => {
    if (!enabled || !tickActionRef.current) return;
    const intervalId = window.setInterval(() => {
      const nowReal = performance.now();
      const deltaReal = Math.max(0, nowReal - lastRealNowRef.current);
      lastRealNowRef.current = nowReal;
      if (paused) return;
      scaledClockRef.current += deltaReal * Math.max(minTimeScale, timeScale);
      const tickStart = performance.now();
      tickActionRef.current?.(scaledClockRef.current);
      onTickDurationMs?.(performance.now() - tickStart);
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [enabled, intervalMs, minTimeScale, onTickDurationMs, paused, timeScale]);
}
