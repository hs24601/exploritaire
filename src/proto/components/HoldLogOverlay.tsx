import { useEffect, useSyncExternalStore } from 'react';
import { clearHoldLog, holdLogEntries, logHold, subscribeHoldLog } from '../holdLog';

let snapshot = holdLogEntries();
let announced = false;
const subscribe = (listener: () => void) => subscribeHoldLog(() => { snapshot = holdLogEntries(); listener(); });

/** Reward-hold timeline for playtesting on a real device; only mounted with `?holdlog`. */
export function HoldLogOverlay() {
  const entries = useSyncExternalStore(subscribe, () => snapshot);
  useEffect(() => {
    const note = (event: Event) => logHold(`${event.type}${'pointerType' in event ? ` (${(event as PointerEvent).pointerType})` : ''} on ${(event.target as Element | null)?.className?.toString().split(' ')[0] || (event.target as Element | null)?.tagName || 'page'}`);
    const events = ['contextmenu', 'pointercancel', 'selectstart', 'dragstart'];
    events.forEach((type) => document.addEventListener(type, note, true));
    if (!announced) logHold(`log on · ${navigator.userAgent.match(/\(([^)]*)\)/)?.[1] ?? navigator.userAgent}`);
    announced = true;
    return () => events.forEach((type) => document.removeEventListener(type, note, true));
  }, []);
  return <div className="hold-log" role="log" aria-label="Hold timing log" onPointerDown={(event) => event.stopPropagation()}>
    <button type="button" onClick={clearHoldLog}>Clear</button>
    {entries.slice(-14).map((entry, index) => <div key={entry.at + ':' + index}>{(entry.at / 1000).toFixed(2)}s {entry.text}</div>)}
  </div>;
}
