import { expect, it } from 'vitest';
import { createCombatSandboxScenario, newActor } from './battle';

it('uses personal HP caps for fresh Keru and the Scenario 1002 party', () => {
  const expected = { dem:40, hero:32, mochi:22, cir:25 } as const;
  const state = createCombatSandboxScenario('1002');
  for (const [id, maxHp] of Object.entries(expected)) {
    expect(newActor(id as keyof typeof expected)).toMatchObject({ hp:maxHp, maxHp });
    expect(state.party.find(actor => actor.id === id)).toMatchObject({ hp:maxHp, maxHp });
  }
  expect(state.party.find(actor => actor.id === 'aldan-seed')).toMatchObject({ hp:40, maxHp:40 });
});

it('keeps explicit training HP overrides', () => {
  for (const actor of createCombatSandboxScenario('009').party) {
    expect(actor).toMatchObject({ hp:40, maxHp:40 });
  }
});
