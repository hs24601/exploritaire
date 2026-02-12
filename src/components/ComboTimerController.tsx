import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

interface ComboTimerControllerProps {
  partyComboTotal: number;
  paused: boolean;
  disabled?: boolean;
  onExpire: (value: number) => void;
  children: (state: {
    displayedCombo: number;
    timerRef: RefObject<HTMLDivElement>;
  }) => ReactNode;
}

const COMBO_TIMER_MS = 10000;

export function ComboTimerController({
  partyComboTotal,
  paused,
  disabled = false,
  onExpire,
  children,
}: ComboTimerControllerProps) {
  const [displayedCombo, setDisplayedCombo] = useState(0);
  const timerRef = useRef<HTMLDivElement | null>(null);
  const comboEndRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef<number>(COMBO_TIMER_MS);
  const prevPartyComboRef = useRef(0);
  const displayedComboRef = useRef(0);

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
      comboEndRef.current = performance.now() + COMBO_TIMER_MS;
    } else if (partyComboTotal < prevPartyComboRef.current) {
      setDisplayedCombo(0);
      comboEndRef.current = null;
    }
    prevPartyComboRef.current = partyComboTotal;
  }, [disabled, partyComboTotal]);

  useEffect(() => {
    if (disabled) return;
    if (!timerRef.current) return;
    if (displayedCombo === 0) {
      timerRef.current.style.setProperty('--combo-fill', '100%');
    }
  }, [displayedCombo]);

  useEffect(() => {
    if (disabled) return;
    const interval = window.setInterval(() => {
      if (!timerRef.current) return;
      const now = performance.now();
      if (comboEndRef.current === null) {
        comboEndRef.current = now + COMBO_TIMER_MS;
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

      const fill = Math.max(0, Math.min(1, remaining / COMBO_TIMER_MS));
      timerRef.current.style.setProperty('--combo-fill', `${fill * 100}%`);
    }, 100);
    return () => window.clearInterval(interval);
  }, [disabled, onExpire, paused]);

  useEffect(() => {
    if (disabled) return;
    if (paused) {
      const now = performance.now();
      pausedRemainingRef.current = Math.max(0, (comboEndRef.current ?? now) - now);
    } else {
      comboEndRef.current = performance.now() + pausedRemainingRef.current;
    }
  }, [disabled, paused]);

  return <>{children({ displayedCombo, timerRef })}</>;
}
