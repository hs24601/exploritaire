import { describe, expect, it } from 'vitest';
import { createPlayableSandboxScenario, type BattleState } from '../proto/rules/battle';
import { battleReceipts } from './battleReceipts';

const receive = (battle: BattleState, rank: number, sequence: number): BattleState => ({
  ...battle,
  party: battle.party.map((actor, index) => index === 0 ? { ...actor, rank, count: actor.count + 1 } : actor),
  momentum: { ...(battle.momentum ?? { value: 0, earned: 0, spent: 0, sequence: 0 }), sequence },
});

describe('battleReceipts', () => {
  it('reports a party receipt with its new rank and the turn combo', () => {
    const start = createPlayableSandboxScenario('100'), next = receive(start, 3, 1);
    expect(battleReceipts(start, next).party).toEqual([{ actorId: start.party[0].id, rank: 3, combo: 1, index: 0, of: start.party.length }]);
    expect(battleReceipts(null, next).party).toEqual([]);
  });
  it('ends the run when the party hands the turn to the enemy', () => {
    const start = { ...createPlayableSandboxScenario('100'), turn: 'party' as const }, next = { ...start, turn: 'enemy' as const };
    expect(battleReceipts(start, next).runEnded).toBe(true);
    expect(battleReceipts(start, start).runEnded).toBe(false);
  });
  it('reports enemy foundation changes on the enemy turn only', () => {
    const start = { ...createPlayableSandboxScenario('100'), turn: 'enemy' as const };
    const next = { ...start, foes: start.foes.map(foe => ({ ...foe, rank: ((foe as { rank?: number }).rank ?? 1) % 13 + 1 })) };
    expect(battleReceipts(start, next).enemy).toHaveLength(start.foes.length);
    expect(battleReceipts({ ...start, turn: 'party' }, { ...next, turn: 'party' }).enemy).toEqual([]);
  });
  it('treats a scenario change as the end of the run, with no notes', () => {
    const a = createPlayableSandboxScenario('100'), b = receive(createPlayableSandboxScenario('101'), 4, 1);
    expect(battleReceipts(a, b)).toEqual({ party: [], enemy: [], runEnded: true });
  });
});
