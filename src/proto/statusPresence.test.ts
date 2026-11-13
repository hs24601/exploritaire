import { expect, it } from 'vitest';
import { reconcileStatusPresence, type StatusPresence } from './statusPresence';

it('cues simultaneous gains and losses without replaying stack countdowns', () => {
  const initial: StatusPresence[] = [{ status: { id: 'duskscale' }, serial: 0 }, { status: { id: 'burn', turns: 2, stacks: 2 }, serial: 0 }];
  const next = reconcileStatusPresence(initial, [{ id: 'deep-breath' }, { id: 'burn', turns: 1, stacks: 2 }], 1);
  expect(next.find(item => item.status.id === 'duskscale')?.phase).toBe('lost');
  expect(next.find(item => item.status.id === 'deep-breath')?.phase).toBe('gained');
  expect(next.find(item => item.status.id === 'burn')?.phase).toBeUndefined();
  expect(next.find(item => item.status.id === 'burn')?.status.turns).toBe(1);
});

it('preserves a departing cue and treats rapid reapplication as a new gain', () => {
  const lost = reconcileStatusPresence([{ status: { id: 'guard' }, serial: 0 }], [], 1);
  expect(reconcileStatusPresence(lost, [], 2)).toEqual(lost);
  expect(reconcileStatusPresence(lost, [{ id: 'guard' }], 3)).toEqual([{ status: { id: 'guard' }, phase: 'gained', serial: 3 }]);
});
