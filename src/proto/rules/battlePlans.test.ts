import { describe, expect, it } from 'vitest';
import { createCombatSandboxScenario, useMomentumSkill, type BattleState } from './battle';
import { tableauPlans } from './battlePlans';

describe('board plans', () => {
  it('a pending party Withdraw marks its destination row until the redeal lands', () => {
    const tyrant = createCombatSandboxScenario('999');
    const pending = useMomentumSkill(tyrant, 'withdraw', 'withdraw-row:2');
    expect(tableauPlans(pending)).toEqual([expect.objectContaining({ by: 'party', target: { kind: 'row', row: 2 }, label: 'Withdraw · row 3' })]);
    expect(tableauPlans(tyrant)).toEqual([]);
    expect(tableauPlans({ ...pending, result: 'lost' })).toEqual([]);
  });

  it('marks an enemy Withdraw across the whole tableau', () => {
    const s = createCombatSandboxScenario('001');
    const plans = tableauPlans({ ...s, turn: 'enemy', pendingWithdraw: { foeId: s.foes[0].id } });
    expect(plans).toEqual([expect.objectContaining({ by: 'enemy', target: { kind: 'tableau' } })]);
  });

  it('marks the exposed cards an intent owner will play next, unless it skips its turn', () => {
    const base = createCombatSandboxScenario('020');
    const s: BattleState = { ...base,
      columns: [5, 13, 13, 13, 13, 13].map((rank, c) => [{ id: `b${c}`, rank: 13 }, { id: `t${c}`, rank }]),
      tutorial: { ...base.tutorial!, intent: { id: 'i', rank: 6, pips: 0, fired: 0, cards: [] } } };
    expect(tableauPlans(s)).toEqual([expect.objectContaining({ by: 'enemy', target: { kind: 'cards', ids: ['t0'] } })]);
    expect(tableauPlans({ ...s, foes: s.foes.map(foe => ({ ...foe, staggered: 1 })) })).toEqual([]);
  });
});
