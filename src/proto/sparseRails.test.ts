import { describe, expect, it } from 'vitest';
import { createDayOneState, dayOnePlan } from './dayScenarios';
import { beginJourney, playTravelCard } from './travelJourney';
import type { ProtoState } from './protoState';

/** Explore every legal choice, not merely the solver's preferred solution. */
function audit(state: ProtoState, seen = new Set<string>()): number {
  const j = state.journey!;
  const key = JSON.stringify([j.rank, j.completed, j.columns.map(c=>c.map(card=>card.id))]);
  if (seen.has(key)) return 0;
  seen.add(key);
  if (j.completed === j.cards) {
    expect(j.columns.flat()).toHaveLength(0);
    expect(j.progress).toBe(1);
    expect(state.haul.mana).toBe(1);
    expect(state.biomeTiles.find(t=>t.id===state.dayScenarioTiles!.sparsePatchId)!.berryHarvested).toBe(true);
    return 1;
  }
  const successors = j.columns.map((_,i)=>playTravelCard(state,i)).filter(next=>next!==state);
  expect(successors.length, 'dead end: '+JSON.stringify({rank:j.rank,completed:j.completed,columns:j.columns.map(c=>c.map(card=>card.rank))})).toBeGreaterThan(0);
  return successors.reduce((count,next)=>count+audit(next,seen),0);
}

describe('unfailable first berry approach', () => {
  it('completes from every legal choice through the cave and bush at every incoming rank', () => {
    for(let rank=1;rank<=13;rank++) {
      const state=createDayOneState();
      const start={...state,journey:beginJourney(dayOnePlan(state),rank)};
      expect(audit(start)).toBeGreaterThan(0);
    }
  });
  it('preserves the fitted bush composition, coverage and one final berry', () => {
    let state=createDayOneState();state={...state,journey:beginJourney(dayOnePlan(state))};
    while(state.journey!.completed<6) {
      const next=state.journey!.columns.map((_,i)=>playTravelCard(state,i)).find(next=>next!==state)!;
      expect(next).toBeDefined();state=next;
    }
    const j=state.journey!;
    expect(j.rank).toBe(2);
    expect(j.columns.map(c=>c.map(card=>card.rank))).toEqual([[7,6],[4],[5,3],[8]]);
    expect(j.columns.flat().every(card=>!!card.pose)).toBe(true);
    expect(j.columns.flat().filter(card=>card.foodSource)).toHaveLength(1);
    expect(j.columns.flat().find(card=>card.foodSource)!.rank).toBe(8);
    expect(state.haul.mana).toBe(0);
  });
});
