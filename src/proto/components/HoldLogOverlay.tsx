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
    // Every press and release anywhere, with what was under it and how late it arrived,
    // so presses the card never sees still show up.
    const press = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest?.('.hold-log')) return;
      const target = event.target as Element | null;
      const card = target?.closest?.('[data-table-quest]');
      const label = card ? `card ${card.getAttribute('data-table-quest')}` : (target?.className?.toString().split(' ')[0] || target?.tagName || 'page');
      logHold(`${event.type.replace('pointer', 'press ')} (${event.pointerType}) on ${label}, ${Math.max(0, Math.round(performance.now() - event.timeStamp))}ms late`);
    };
    document.addEventListener('pointerdown', press, true);
    document.addEventListener('pointerup', press, true);
    // Main-thread stalls that would hold back presses or the hold's progress.
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => list.getEntries().forEach((entry) => { if (entry.duration >= 150) logHold(`page busy ${Math.round(entry.duration)}ms`); }));
      observer.observe({ type: 'longtask', buffered: false });
    } catch { observer = null; }
    if (!announced) logHold(`log on · ${navigator.userAgent.match(/\(([^)]*)\)/)?.[1] ?? navigator.userAgent}`);
    announced = true;
    return () => {
      events.forEach((type) => document.removeEventListener(type, note, true));
      document.removeEventListener('pointerdown', press, true);
      document.removeEventListener('pointerup', press, true);
      observer?.disconnect();
    };
  }, []);
  return <div className="hold-log" role="log" aria-label="Hold timing log" onPointerDown={(event) => event.stopPropagation()}>
    <button type="button" onClick={clearHoldLog}>Clear</button>
    <div className="hold-log__note">Times are seconds since the page opened</div>
    {entries.slice(-14).map((entry, index) => <div key={entry.at + ':' + index}>{(entry.at / 1000).toFixed(2)}s {entry.text}</div>)}
  </div>;
}
