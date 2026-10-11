import { afterEach, describe, expect, it } from 'vitest';
import { ACTOR_STAMINA_MAX } from '../protoState';
import { SPIRITS } from './battleAbilities';
import { actorRedrawOptions, createBattle, playCard, redrawActor, setSpirit, type BattleState } from './battle';

const deal = { tableau: [[{ id: 'a', rank: 9 }, { id: 'b', rank: 3 }]], stock: [] };
const hero = (state: BattleState) => state.party.find((actor) => actor.id === 'hero')!;

describe('battle foundation redraw', () => {
  afterEach(() => { delete SPIRITS.test; });

  it('starts each actor with their stamina, full by default', () => {
    const battle = createBattle(deal, { stamina: { hero: 2 } });
    expect(hero(battle).stamina).toBe(2);
    expect(battle.party.find((actor) => actor.id === 'mochi')!.stamina).toBe(ACTOR_STAMINA_MAX);
  });

  it('abandons the foundation value for a new one at 1 stamina, keeping charge and cards', () => {
    const played = playCard(createBattle(deal, { mochi: false }), 0, 'hero');
    expect(hero(played)).toMatchObject({ rank: 3, count: 1, charge: 1, stamina: ACTOR_STAMINA_MAX });
    const redrawn = redrawActor(played, 'hero', { kind: 'draw' }, 0.5);
    expect(hero(redrawn).rank).not.toBe(3);
    expect(hero(redrawn)).toMatchObject({ count: 1, charge: 1, stamina: ACTOR_STAMINA_MAX - 1 });
    expect(redrawn.columns).toBe(played.columns);
  });

  it('is refused at 0 stamina, for a downed actor or after the fight', () => {
    const battle = createBattle(deal, { stamina: { hero: 0 } });
    expect(redrawActor(battle, 'hero')).toBe(battle);
    const fresh = createBattle(deal);
    expect(redrawActor({ ...fresh, result: 'won' }, 'hero')).toEqual({ ...fresh, result: 'won' });
    const downed = { ...fresh, party: fresh.party.map((actor) => ({ ...actor, hp: 0 })) };
    expect(redrawActor(downed, 'hero')).toBe(downed);
  });

  it("offers a spirit companion's fixed value, only while that spirit is with the actor", () => {
    SPIRITS.test = { ...SPIRITS.cal, id: 'test', name: 'Test', redrawRank: 11 };
    const battle = createBattle(deal, { mochi: false });
    const choice = { kind: 'spirit' as const, spiritId: 'test', rank: 11 };
    expect(actorRedrawOptions(hero(battle))).toEqual([{ kind: 'draw' }]);
    expect(redrawActor(battle, 'hero', choice)).toBe(battle);
    const joined = setSpirit(battle, 'hero', 'test', true);
    expect(actorRedrawOptions(hero(joined))).toEqual([{ kind: 'draw' }, choice]);
    expect(hero(redrawActor(joined, 'hero', choice))).toMatchObject({ rank: 11, stamina: ACTOR_STAMINA_MAX - 1 });
  });
});
