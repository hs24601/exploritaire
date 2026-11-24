import { describe, expect, it } from 'vitest';
import { actorAttack, applyAttack, createBattle, inspectActorAbility, previewAttack } from './battle';
import { combatMovesFor } from './battleAbilities';

describe('ability inspection without AP', () => {
  it('describes every tray ability at zero AP without making it playable', () => {
    const battle = createBattle({ tableau: [], stock: [] }, { mochi: true });
    for (const actor of battle.party) for (const move of combatMovesFor(actor.id)) {
      const key = actor.id + ':' + move.name;
      expect(actor.charge).toBe(0);
      expect(inspectActorAbility(battle, key)).toMatchObject({ actorId: actor.id, form: move.name, charge: move.cost });
      expect(actorAttack(battle, key)).toBeNull();
      expect(previewAttack(battle, key, 'dark-slime')).toBeNull();
      expect(applyAttack(battle, key, 'dark-slime')).toBe(battle);
    }
  });
  it('keeps Vice Grip inspection commitment separate from available AP', () => {
    const battle = createBattle({ tableau: [], stock: [] });
    expect(inspectActorAbility(battle, 'hero:Vice Grip:20')?.charge).toBe(20);
    expect(actorAttack(battle, 'hero:Vice Grip:20')).toBeNull();
    expect(inspectActorAbility(battle, 'hero:Vice Grip:NaN')).toBeNull();
    expect(inspectActorAbility(battle, 'missing:Nip')).toBeNull();
  });
});
