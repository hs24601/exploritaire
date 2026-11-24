import { describe, expect, it } from 'vitest';
import { EVENT_CARDS_ENABLED, spawnTableauEvent } from './eventCards';
import { createInitialState } from './rules/setup';
import { beginJourney, bestTravelMove, planTravel, playTravelCard, prepareTravelTableau, removeTravelEvents, travelTableauHeld } from './travelJourney';

describe('events suspended in live play', () => {
  const setup = () => {
    const state = createInitialState(false);
    return { ...state, biomeTiles: [], worldActors: [{ id: 'hero', label: 'Hero', location: 'table' as const, position: { x: 0, y: 0 } }], journey: beginJourney(planTravel('hero', [{ x: 0, y: 0, pace: 0 }, { x: 48, y: 0, pace: 1 }], [])) };
  };
  it('keeps easy crossing cards, AP, combo and mastery without offering SEARCH or holding arrival', () => {
    expect(EVENT_CARDS_ENABLED).toBe(false);
    let state = prepareTravelTableau(setup());
    for (let i = 0; i < 3; i++) state = playTravelCard(state, bestTravelMove(state.journey!)!);
    expect(state.journey?.completed).toBe(3);
    expect(state.journey?.progress).toBe(1);
    expect(state.journey?.pendingSearch).toBeUndefined();
    expect(state.journey?.columns.flat()).toEqual([]);
    expect(travelTableauHeld(state.journey!)).toBe(false);
    expect(state.utilityAP?.hero).toBe(3);
    expect(state.journey?.streak).toBe(3);
    expect(state.terrainCrossings?.path).toBe(1);
  });
  it('does not insert authored event cards and releases existing event decisions without losing backfill', () => {
    const state = setup();
    const event = { id: 'old-event', rank: 2, segment: 0, kind: 'path', event: { id: 'old', title: 'OLD', description: '', solutions: [{ type: 'wildcard' as const }], effect: { type: 'notice' as const, message: '' } } };
    expect(spawnTableauEvent(state.journey.columns, event)).toEqual(state.journey.columns);
    const deferred = state.journey.columns[0].pop()!;
    state.journey.columns.push([event]);
    const pending = { ...state, journey: { ...state.journey, pendingSearch: 0, eventBackfill: { card: deferred, column: 0, index: 0 } } };
    const restored = removeTravelEvents(pending);
    expect(restored.journey?.columns).toHaveLength(7);
    expect(restored.journey?.columns.flat()).toHaveLength(3);
    expect(restored.journey?.columns[0][0]).toEqual(deferred);
    expect(restored.journey?.pendingSearch).toBeUndefined();
    expect(restored.journey?.spent).toBe(pending.journey.spent);
    expect(removeTravelEvents(restored)).toBe(restored);
  });
});
