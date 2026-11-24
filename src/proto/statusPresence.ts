import type { UnitStatus } from './rules/battleStatusData';

export type StatusPresence = { status: UnitStatus; phase?: 'gained' | 'lost'; serial: number };

/** Keep lost icons briefly for their exit cue. Stack/turn changes are not gains. */
export function reconcileStatusPresence(previous: StatusPresence[], statuses: readonly UnitStatus[], serial: number): StatusPresence[] {
  const next: StatusPresence[] = statuses.map(status => {
    const old = previous.find(item => item.status.id === status.id);
    return old && old.phase !== 'lost' ? { ...old, status } : { status, phase: 'gained', serial };
  });
  for (const old of previous) {
    if (!statuses.some(status => status.id === old.status.id)) {
      next.push(old.phase === 'lost' ? old : { ...old, phase: 'lost', serial });
    }
  }
  return next;
}
