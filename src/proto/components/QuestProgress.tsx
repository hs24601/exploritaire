import { useLayoutEffect, useRef, useState } from 'react';
import type { QuestProgressValue } from '../tutorialQuests';
import { ManaberryIcon } from './ManaberryIcon';
import './QuestProgress.css';

/** Shared card-local progress; receipts settle here before quest completion. */
export function QuestProgress({ value }: { value: QuestProgressValue }) {
  const root = useRef<HTMLSpanElement>(null);
  const latest = useRef(value.current); latest.current = value.current;
  const pending = useRef(0);
  const [shown, setShown] = useState(value.current);
  const [pulse, setPulse] = useState(0);
  useLayoutEffect(() => { if (!pending.current) setShown(value.current); }, [value.current]);
  useLayoutEffect(() => {
    const start = () => { if (root.current?.closest('.quest-subtask-deck')) pending.current++; };
    const end = () => {
      if (!pending.current) return;
      if (--pending.current === 0) { setShown(latest.current); setPulse(n => n + 1); }
    };
    window.addEventListener('proto-quest-receipt-start', start);
    window.addEventListener('proto-quest-receipt-end', end);
    return () => { window.removeEventListener('proto-quest-receipt-start', start); window.removeEventListener('proto-quest-receipt-end', end); };
  }, []);
  return <span ref={root} className="quest-progress" data-kind={value.kind} data-quest-progress-dock="true" role="progressbar" aria-live="polite" aria-label={value.kind === 'berries' ? 'Manaberries collected' : 'Cards played to Hero'} aria-valuemin={0} aria-valuemax={value.total} aria-valuenow={shown}>
    <span key={pulse + ':' + shown} className="quest-progress__receipt"><span aria-hidden="true">{value.kind === 'berries' ? <ManaberryIcon /> : '▧'}</span><strong>{shown}/{value.total}</strong></span>
    <span className="quest-progress__track" aria-hidden="true"><span style={{ width: `${Math.min(1, shown / value.total) * 100}%` }} /></span>
  </span>;
}
