import { describe, expect, it } from 'vitest';
import { activateBiome, arriveActorAtBiome } from '../biomeArrival';
import { cloneState, createInitialState } from './setup';
import { applyFoundationPlay } from './play';
import { eatSupper, ordinaryHour } from './ordinaryDay';
import { biomeTileSprite } from '../protoData';

describe('an ordinary first day', () => {
  it('opens rested and awake at home with an empty tableau', () => {
    const state = createInitialState();
    expect(state.stamina).toBe(state.maxStamina);
    expect(state.actorStamina[0]).toBe(4);
    expect(state.selectedBiomeId).toBeNull();
    expect(state.tableau).toEqual([]);
    expect(state.foundations).toEqual([]);
    expect(state.worldActors[0].location).toBe('table');
    expect(activateBiome(state, 'hero-den')).toBe(state);
    expect(eatSupper(state)).toBe(state);
    expect(ordinaryHour(state)).toBe(9);
    expect(cloneState(state).ordinaryDay).not.toBe(state.ordinaryDay);
    const patch = state.biomeTiles.find(tile => tile.id === 'day-one-berries')!;
    expect(patch.tileType).toBe('berry-patch');
    expect(biomeTileSprite({ ...patch, id: 'another-patch' })).toContain('berry-bush.svg');
    expect(patch.tableau.flat().every(card => card.resource === 'berries')).toBe(true);
  });
  it('gathers enough food in two normal plays and returns home without starting sleep', () => {
    let state = arriveActorAtBiome(createInitialState(), 'hero', 'day-one-berries', { x: -48, y: 48 });
    for (let columnIndex = 0; columnIndex < 2; columnIndex++) {
      state = applyFoundationPlay(state, { columnIndex, foundationIndex: 0 })!.state;
    }
    expect(state.haul.berries).toBe(2);
    expect(state.haul.wood).toBe(0);
    expect(ordinaryHour(state)).toBe(16);
    expect(eatSupper(state)).toBe(state); // must go home
    state = arriveActorAtBiome(state, 'hero', 'hero-den', { x: 0, y: 96 });
    expect(state.selectedBiomeId).toBeNull();
    expect(state.tableau).toEqual([]);
    const fed = eatSupper(state);
    expect(fed.haul.berries).toBe(0);
    expect(fed.settledHaul.berries).toBe(0);
    expect(fed.heroBuffs[0].filter(buff => buff.id === 'well_fed')).toHaveLength(1);
    expect(eatSupper(fed)).toBe(fed); // no duplicate consumption
    expect(ordinaryHour(fed)).toBe(18.5);
    const asleep = arriveActorAtBiome({ ...fed, ordinaryDay: { ...fed.ordinaryDay!, bedtime: true } }, 'hero', 'hero-den', { x: 0, y: 96 });
    expect(asleep.selectedBiomeId).toBe('hero-den');
    expect(asleep.tableau.map(column => column.length)).toEqual([5, 5, 5, 5, 5, 5]);
    expect(asleep.stock).toHaveLength(21);
    expect(ordinaryHour(asleep)).toBe(21);
  });
  it('keeps picked cards gone and remembers the optional old-tree visit', () => {
    let state = arriveActorAtBiome(createInitialState(), 'hero', 'day-one-berries', { x: -48, y: 48 });
    state = applyFoundationPlay(state, { columnIndex: 0, foundationIndex: 0 })!.state;
    state = arriveActorAtBiome(state, 'hero', 'day-one-tree', { x: 48, y: 0 });
    expect(state.ordinaryDay?.visitedTree).toBe(true);
    state = arriveActorAtBiome(state, 'hero', 'day-one-berries', { x: -48, y: 48 });
    expect(state.tableau[0]).toEqual([]);
    expect(state.haul.berries).toBe(1);
  });
});
