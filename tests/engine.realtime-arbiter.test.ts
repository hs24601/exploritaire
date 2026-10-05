import { describe, expect, it } from 'vitest';
import {
  advanceCombatActionArbiter,
  createCombatActionArbiter,
  queueCombatAction,
  setCombatActionArbiterPaused,
} from '../src/engine/combat/realtimeArbiter';

const ticket = (id: string, side: 'player' | 'enemy', submittedAtMs: number, arrivalAtMs: number) => ({
  id,
  side,
  sourceKey: `tableau:${id}`,
  submittedAtMs,
  arrivalAtMs,
  payload: id,
});

describe('combat action arbiter', () => {
  it('keeps the full pause state inert', () => {
    const initial = setCombatActionArbiterPaused(createCombatActionArbiter({ nowMs: 0 }), true);
    expect(queueCombatAction(initial, ticket('p1', 'player', 0, 50))).toBeNull();
    expect(advanceCombatActionArbiter(initial, 100, () => 'resolved')).toEqual({
      state: initial,
      resolved: [],
      sideChanged: false,
    });
  });

  it('enforces active-side ownership in turn-based pressure', () => {
    const initial = createCombatActionArbiter({ nowMs: 0 });
    expect(queueCombatAction(initial, ticket('e1', 'enemy', 0, 50))).toBeNull();
    const queued = queueCombatAction(initial, ticket('p1', 'player', 0, 50));
    expect(queued?.tickets).toHaveLength(1);
  });

  it('refreshes rolling initiative only when a card arrives successfully', () => {
    const initial = createCombatActionArbiter({ mode: 'rolling_initiative', nowMs: 0, rollingWindowMs: 100 });
    const queued = queueCombatAction(initial, ticket('p1', 'player', 0, 75));
    expect(queued).not.toBeNull();
    const result = advanceCombatActionArbiter(queued!, 75, () => 'resolved');
    expect(result.state.activeSide).toBe('player');
    expect(result.state.rollingDeadlineAtMs).toBe(175);
  });

  it('switches initiative when a rolling deadline passes before a card arrives', () => {
    const initial = createCombatActionArbiter({ mode: 'rolling_initiative', nowMs: 0, rollingWindowMs: 100 });
    const queued = queueCombatAction(initial, ticket('p1', 'player', 0, 150));
    const result = advanceCombatActionArbiter(queued!, 100, () => 'resolved');
    expect(result.sideChanged).toBe(true);
    expect(result.state.activeSide).toBe('enemy');
    expect(result.state.tickets).toHaveLength(1);
  });

  it('catches up a long inactive rolling clock without iterating each missed window', () => {
    const initial = createCombatActionArbiter({ mode: 'rolling_initiative', nowMs: 0, rollingWindowMs: 100 });
    const result = advanceCombatActionArbiter(initial, 1_000_000, () => 'resolved');
    expect(result.state.rollingDeadlineAtMs).toBe(1_000_100);
    expect(result.state.activeSide).toBe('player');
  });

  it('allows both teams to queue in shared realtime and resolves arrival order deterministically', () => {
    const initial = createCombatActionArbiter({ mode: 'real_time_shared', nowMs: 0 });
    const playerQueued = queueCombatAction(initial, ticket('p1', 'player', 0, 90));
    const bothQueued = queueCombatAction(playerQueued!, ticket('e1', 'enemy', 0, 60));
    const result = advanceCombatActionArbiter(bothQueued!, 100, () => 'resolved');
    expect(result.resolved.map((entry) => entry.ticket.id)).toEqual(['e1', 'p1']);
  });

  it('reserves a source until its ticket resolves', () => {
    const initial = createCombatActionArbiter({ mode: 'real_time_shared', nowMs: 0 });
    const queued = queueCombatAction(initial, ticket('p1', 'player', 0, 50));
    expect(queueCombatAction(queued!, { ...ticket('p2', 'player', 0, 60), sourceKey: 'tableau:p1' })).toBeNull();
  });
});
