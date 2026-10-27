import { useCallback, useRef, useState } from 'react';
import type { CalloutProps } from '../components/Callout';

export type CalloutEntry = Omit<CalloutProps, 'visible' | 'onDismiss' | 'instanceKey'> & { id: number };
/** Bounded active messages. Replace by speaker to avoid repeated event chatter piling up. */
export function useCallouts(limit = 3) {
  const [callouts, setCallouts] = useState<CalloutEntry[]>([]);
  const sequence = useRef(0);
  const show = useCallback((message: Omit<CalloutEntry, 'id'>) => {
    const id = ++sequence.current;
    setCallouts(current => [...current.filter(entry => !message.speaker || entry.speaker !== message.speaker),
      { ...message, id }].slice(-Math.max(1, limit)));
    return id;
  }, [limit]);
  const dismiss = useCallback((id: number) => setCallouts(current => current.filter(entry => entry.id !== id)), []);
  const clear = useCallback(() => setCallouts([]), []);
  return { callouts, show, dismiss, clear };
}
