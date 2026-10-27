import { describe, expect, it } from 'vitest';
import { activateBiome, arriveActorAtBiome } from '../biomeArrival';
import { addForestHaul, cloneState, createInitialState } from './setup';
import { applyFoundationPlay } from './play';
import { eatSupper, ordinaryHour } from './ordinaryDay';
import { createOrdinaryPlaces } from './ordinaryDay';
import { biomeTileSprite } from '../protoData';
import { redrawFoundation } from './redraw';
import { cardResourceFace } from '../cardResourceFace';

describe('an ordinary first day', () => {
  it('opens rested and awake at home with an empty tableau', () => {
    const state = createInitialState();
    expect(state.inspiration).toBe(state.maxInspiration);
    expect(state.actorInspiration[0]).toBe(4);
    expect(state.selectedBiomeId).toBeNull();
    expect(state.tableau).toEqual([]);
    expect(state.foundations).toEqual([]);
    expect(state.worldActors[0].location).toBe('table');
    expect(activateBiome(state, 'hero-den')).toBe(state);
    expect(eatSupper(state)).toBe(state);
    expect(ordinaryHour(state)).toBe(0);
    expect(cloneState(state).ordinaryDay).not.toBe(state.ordinaryDay);
    const combat = state.biomeTiles.find(tile => tile.id === 'woods-danger')!;
    expect(combat.position).toEqual({ x: -144, y: 48 });
    expect(combat.danger).toBe(true);
    expect(combat.flags).toContain('danger');
    const patch = state.biomeTiles.find(tile => tile.id === 'day-one-berries')!;
    expect(patch.tileType).toBe('berry-patch');
    expect(biomeTileSprite({ ...patch, id: 'another-patch' })).toContain('berry-bush.svg');
    expect(patch.resourceDensity).toBe(0.2);
    expect(patch.tableau.map(column => column.length)).toEqual(Array(7).fill(4));
    expect(patch.tableau.flat().filter(card => card.resource === 'mana')).toHaveLength(6);
    expect(patch.tableau.flat().filter(card => card.foodSource === 'berries')).toHaveLength(6);
    expect(patch.tableau.flat().filter(card => card.questStep !== undefined && card.resource === 'mana')).toHaveLength(2);
    expect(patch.tableau.flat().filter(card => card.questStep !== undefined && card.foodSource === 'berries')).toHaveLength(2);
  });
  it('gathers enough mana in six normal plays and returns home without starting sleep', () => {
    let state = arriveActorAtBiome(createInitialState(), 'hero', 'day-one-berries', { x: -48, y: 48 });
    for (let columnIndex = 0; columnIndex < 6; columnIndex++) {
      state = applyFoundationPlay(state, { columnIndex, foundationIndex: 0 })!.state;
    }
    expect(state.haul.mana).toBe(2);
    expect(state.haul.wood).toBe(0);
    expect(ordinaryHour(state)).toBe(16);
    expect(eatSupper(state)).toBe(state); // must go home
    state = arriveActorAtBiome(state, 'hero', 'hero-den', { x: 0, y: 96 });
    expect(state.selectedBiomeId).toBeNull();
    expect(state.tableau).toEqual([]);
    const fed = eatSupper(state);
    expect(fed.haul.mana).toBe(0);
    expect(fed.settledHaul.mana).toBe(0);
    expect(fed.heroBuffs[0].filter(buff => buff.id === 'well_fed')).toHaveLength(1);
    expect(eatSupper(fed)).toBe(fed); // no duplicate consumption
    expect(ordinaryHour(fed)).toBe(18.5);
    const asleep = arriveActorAtBiome({ ...fed, ordinaryDay: { ...fed.ordinaryDay!, bedtime: true } }, 'hero', 'hero-den', { x: 0, y: 96 });
    expect(asleep.selectedBiomeId).toBe('hero-den');
    expect(asleep.tableau.map(column => column.length)).toEqual([5, 5, 5, 5, 5, 5]);
    expect(asleep.stock).toHaveLength(21);
    expect(ordinaryHour(asleep)).toBe(21);
  });
  it('converts all collected food to mana without source inventory keys', () => {
    const state = createInitialState();
    expect(addForestHaul(state.haul, { wood: 2, mana: 1, herbs: 3, minnow: 1, kingfish: 1, glowfish: 1 })).toEqual({ wood: 2, mana: 7 });
  });
  it('seeds one INSP on the first Jack and funds a random foundation redraw', () => {
    let state = arriveActorAtBiome(createInitialState(), 'hero', 'day-one-berries', { x: -48, y: 48 });
    state = { ...state, actorInspiration: state.actorInspiration.map(() => 0) };
    const pickups = state.tableau.flat().filter(card => card.inspirationResource);
    expect(pickups).toHaveLength(1);
    expect(pickups[0]).toMatchObject({ rank: 11, questStep: 8 });
    expect(cardResourceFace(pickups[0])).toEqual({ label: 'Inspiration · 1 INSP', glyph: '💫' });
    for (let step = 0; step < 10; step++) {
      state = applyFoundationPlay(state, { columnIndex: step % 7, foundationIndex: 0 })!.state;
      expect(state.actorInspiration[0]).toBe(step < 8 ? 0 : 1);
      expect(state.actorInspiration.slice(1).every(value => value === 0)).toBe(true);
    }
    expect(state.haul).toEqual({ wood: 0, mana: 2 });
    const redraw = redrawFoundation({ rank: state.foundations[0]!.card.rank, inspiration: state.actorInspiration[0] }, { kind: 'draw' }, 0);
    expect(redraw).toEqual({ rank: 1, inspiration: 0 });
  });
  it('preserves the ten seeded plays and refills only their columns with no completion bonus', () => {
    for (const seed of [1, 31, 999]) {
      const initial = createInitialState();
      let state = arriveActorAtBiome({ ...initial, biomeTiles: initial.biomeTiles.map(tile => tile.id === 'day-one-berries' ? createOrdinaryPlaces(seed)[0] : tile) }, 'hero', 'day-one-berries', { x: -48, y: 48 });
      for (let step = 0; step < 10; step++) {
        const played = applyFoundationPlay(state, { columnIndex: step % 7, foundationIndex: 0 });
        expect(played).not.toBeNull();
        const before = state;
        state = played!.state;
        expect(state.tableau.map(column => column.length)).toEqual(Array(7).fill(4));
        expect(state.tableau.flat().filter(card => card.resource === 'mana')).toHaveLength(6);
        expect(state.tableau.flat().filter(card => card.foodSource === 'berries')).toHaveLength(6);
        expect(state.tableau[step % 7].slice(1)).toEqual(before.tableau[step % 7].slice(0, -1));
        expect(state.tableau[step % 7][0].questStep).toBeUndefined();
        expect(state.foundations[0]?.card.foodSource).toBeUndefined();
        expect(state.foundations[0]?.cards.every(card => !card.foodSource)).toBe(true);
        expect(state.haul.mana).toBe(step < 5 ? 1 : 2);
      }
      expect(state.tableau.flat().filter(card => card.questStep !== undefined)).toEqual([]);
      expect(state.haul).toEqual({ wood: 0, mana: 2 });
      // After Queen, normal rank adjacency governs the random cards.
      state = { ...state, tableau: state.tableau.map((column, index) => index === 0
        ? [...column.slice(0, -1), { id: 'random-king', rank: 13 }]
        : column) };
      const continued = applyFoundationPlay(state, { columnIndex: 0, foundationIndex: 0 });
      expect(continued?.state.foundations[0]?.card.rank).toBe(13);
      expect(continued?.state.tableau[0]).toHaveLength(4);
      expect(continued?.state.tableau[0].slice(1)).toEqual(state.tableau[0].slice(0, -1));
      expect(continued?.state.tableau[0][0].rank).toBeGreaterThanOrEqual(1);
      expect(continued?.state.tableau[0][0].rank).toBeLessThanOrEqual(13);
    }
  });
  it('keeps picked cards gone and remembers the optional old-tree visit', () => {
    let state = arriveActorAtBiome(createInitialState(), 'hero', 'day-one-berries', { x: -48, y: 48 });
    state = applyFoundationPlay(state, { columnIndex: 0, foundationIndex: 0 })!.state;
    state = arriveActorAtBiome(state, 'hero', 'day-one-tree', { x: 48, y: 0 });
    expect(state.ordinaryDay?.visitedTree).toBe(true);
    state = arriveActorAtBiome(state, 'hero', 'day-one-berries', { x: -48, y: 48 });
    expect(state.tableau[0].filter(card => card.questStep !== undefined).map(card => card.questStep)).toEqual([7]);
    expect(state.haul.mana).toBe(1);
  });
});

