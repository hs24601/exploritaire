import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

interface ComboTimerControllerProps {
  partyComboTotal: number;
  paused: boolean;
  disabled?: boolean;
  timeScale?: number;
  bonusExtendMs?: number;
  bonusExtendToken?: number;
  secondaryBonusExtendMs?: number;
  secondaryBonusExtendToken?: number;
  onExpire: (value: number) => void;
  children: (state: {
    displayedCombo: number;
    timerRef: RefObject<HTMLDivElement>;
    remainingMs: number;
    visualMaxMs: number;
  }) => ReactNode;
}

const COMBO_TIMER_MS = 10000;

export function ComboTimerController({
  partyComboTotal,
  paused,
  disabled = false,
  timeScale = 1,
  bonusExtendMs = 0,
  bonusExtendToken,
  secondaryBonusExtendMs = 0,
  secondaryBonusExtendToken,
  onExpire,
  children,
}: ComboTimerControllerProps) {
  const [displayedCombo, setDisplayedCombo] = useState(0);
  const timerRef = useRef<HTMLDivElement | null>(null);
  const comboEndRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef<number>(COMBO_TIMER_MS);
  const prevPartyComboRef = useRef(0);
  const displayedComboRef = useRef(0);
  const lastBonusTokenRef = useRef<number | undefined>(undefined);
  const lastSecondaryBonusTokenRef = useRef<number | undefined>(undefined);

  const resolvedTimeScale = Math.max(0.1, timeScale);
  const timerDurationMs = COMBO_TIMER_MS / resolvedTimeScale;
  const [timerSnapshot, setTimerSnapshot] = useState(() => ({
    remainingMs: timerDurationMs,
    visualMaxMs: timerDurationMs,
  }));
  useEffect(() => {
    setTimerSnapshot((current) => ({
      remainingMs: Math.min(current.remainingMs, timerDurationMs),
      visualMaxMs: timerDurationMs,
    }));
  }, [timerDurationMs]);

  const updateTimerFill = useCallback(() => {
    if (!timerRef.current) return;
    const now = performance.now();
    const remaining = paused
      ? pausedRemainingRef.current
      : Math.max(0, (comboEndRef.current ?? now) - now);
    const fill = Math.max(0, Math.min(1, remaining / timerDurationMs));
    timerRef.current.style.setProperty('--combo-fill', `${fill * 100}%`);
  }, [paused, timerDurationMs]);

    const extendTimer = useCallback(
      (ms: number) => {
        if (disabled || ms <= 0) return;
        if (paused) {
          pausedRemainingRef.current = Math.max(0, pausedRemainingRef.current + ms);
          updateTimerFill();
          setTimerSnapshot({
            remainingMs: pausedRemainingRef.current,
            visualMaxMs: timerDurationMs,
          });
          return;
        }
        const now = performance.now();
        if (!comboEndRef.current) {
          comboEndRef.current = now + timerDurationMs;
        } else {
          comboEndRef.current += ms;
        }
        updateTimerFill();
        const remainingAfterExtend = Math.max(0, (comboEndRef.current ?? now) - now);
        setTimerSnapshot({
          remainingMs: remainingAfterExtend,
          visualMaxMs: timerDurationMs,
        });
      },
      [disabled, paused, timerDurationMs, updateTimerFill]
    );

  useEffect(() => {
    displayedComboRef.current = displayedCombo;
  }, [displayedCombo]);

  useEffect(() => {
    if (disabled) {
      setDisplayedCombo(partyComboTotal);
      comboEndRef.current = null;
      if (timerRef.current) {
        timerRef.current.style.setProperty('--combo-fill', '100%');
      }
      prevPartyComboRef.current = partyComboTotal;
      return;
    }
    if (partyComboTotal > prevPartyComboRef.current) {
      const delta = partyComboTotal - prevPartyComboRef.current;
      setDisplayedCombo((prev) => prev + delta);
      comboEndRef.current = performance.now() + timerDurationMs;
    } else if (partyComboTotal < prevPartyComboRef.current) {
      setDisplayedCombo(0);
      comboEndRef.current = null;
    }
    prevPartyComboRef.current = partyComboTotal;
  }, [disabled, partyComboTotal, timerDurationMs]);

  useEffect(() => {
    if (disabled) return;
    if (!timerRef.current) return;
    if (displayedCombo === 0) {
      timerRef.current.style.setProperty('--combo-fill', '100%');
    }
  }, [disabled, displayedCombo]);

  useEffect(() => {
    if (disabled) return;
    if (comboEndRef.current) return;
    pausedRemainingRef.current = timerDurationMs;
  }, [disabled, timerDurationMs]);

  useEffect(() => {
    if (disabled) return;
    if (paused) {
      const now = performance.now();
      pausedRemainingRef.current = Math.max(0, (comboEndRef.current ?? now) - now);
      setTimerSnapshot({
        remainingMs: pausedRemainingRef.current,
        visualMaxMs: timerDurationMs,
      });
    } else {
      comboEndRef.current = performance.now() + pausedRemainingRef.current;
      setTimerSnapshot({
        remainingMs: pausedRemainingRef.current,
        visualMaxMs: timerDurationMs,
      });
    }
  }, [disabled, paused, timerDurationMs]);

  useEffect(() => {
    if (disabled) return;
    const interval = window.setInterval(() => {
      if (!timerRef.current) return;
      const now = performance.now();
      if (comboEndRef.current === null) {
        comboEndRef.current = now + timerDurationMs;
      }
      const remaining = paused
        ? pausedRemainingRef.current
        : Math.max(0, comboEndRef.current - now);

      if (!paused && remaining === 0) {
        const achieved = displayedComboRef.current;
        if (achieved > 0) {
          onExpire(achieved);
        }
        setDisplayedCombo(0);
        comboEndRef.current = null;
        timerRef.current.style.setProperty('--combo-fill', '100%');
        return;
      }

      const fill = Math.max(0, Math.min(1, remaining / timerDurationMs));
      timerRef.current.style.setProperty('--combo-fill', `${fill * 100}%`);
      setTimerSnapshot({
        remainingMs: paused ? pausedRemainingRef.current : remaining,
        visualMaxMs: timerDurationMs,
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [disabled, onExpire, paused, timerDurationMs]);

  useEffect(() => {
    if (disabled) return;
    if (bonusExtendToken === undefined) return;
    if (bonusExtendToken === lastBonusTokenRef.current) return;
    lastBonusTokenRef.current = bonusExtendToken;
    extendTimer(bonusExtendMs ?? 0);
  }, [bonusExtendMs, bonusExtendToken, disabled, extendTimer]);

  useEffect(() => {
    if (disabled) return;
    if (secondaryBonusExtendToken === undefined) return;
    if (secondaryBonusExtendToken === lastSecondaryBonusTokenRef.current) return;
    lastSecondaryBonusTokenRef.current = secondaryBonusExtendToken;
    extendTimer(secondaryBonusExtendMs ?? 0);
  }, [disabled, secondaryBonusExtendMs, secondaryBonusExtendToken, extendTimer]);

  return (
    <>
      {children({
        displayedCombo,
        timerRef,
        remainingMs: timerSnapshot.remainingMs,
        visualMaxMs: timerSnapshot.visualMaxMs,
      })}
    </>
  );
}
