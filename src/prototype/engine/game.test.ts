import { describe, expect, it } from 'vitest';
import { applyReward, canPlayCardOnHero, createInitialState, playCard, playWild, spendResolve, useAbility } from './game';
import { modifiersById } from './catalog';

describe('prototype game engine', () => {
  it('allows empty foundations to start with any number card', () => {
    const state = createInitialState();
    const firstCard = state.tableau[0][0];

    expect(canPlayCardOnHero(state, firstCard, 'knight')).toBe(true);
  });

  it('chains by adjacent values and consumes combo into damage', () => {
    let state = createInitialState();
    state = playCard(state, 'r0-c0', 'knight');
    state = playCard(state, 'r0-c1', 'knight');
    state = { ...state, activeEnemy: { id: 'slime', hp: 6, maxHp: 6 }, mode: 'combat' };

    state = useAbility(state, 'slash');

    expect(state.activeEnemy?.hp).toBe(3);
    expect(state.heroes.knight.combo).toHaveLength(0);
  });

  it('uses wild cards as bridge cards after spending resolve', () => {
    let state = createInitialState();
    state = playCard(state, 'r0-c0', 'mage');
    state = spendResolve(state);
    state = playWild(state, 'mage');

    expect(state.resolve).toBe(2);
    expect(state.wildCards).toBe(0);
    expect(canPlayCardOnHero(state, state.tableau[0][2], 'mage')).toBe(true);
  });

  it('lets rewards attach a selected modifier to a remaining number card', () => {
    let state = createInitialState();
    state = { ...state, mode: 'reward', reward: { availableModifierIds: ['fire', 'ice', 'holy', 'poison'] } };

    state = applyReward(state, 'r0-c2', 'poison');

    expect(state.mode).toBe('exploration');
    expect(state.tableau[0][2].modifierId).toBe('poison');
    expect(modifiersById.poison.name).toBe('Poison');
  });
});
