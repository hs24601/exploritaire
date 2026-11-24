import { describe, it, expect } from 'vitest';
import { createInitialState } from './rules/setup';
import { paintTravelProgress, discardTravelEvent, bestTravelMove, beginJourney, planTravel, playTravelCard, redrawTravel, traversalProfile, travelPlayable } from './travelJourney';
import type { TravelTerrain } from './travelJourney';
const tile = (id: string, x: number, kind: 'dirt' | 'berry-patch' | undefined): TravelTerrain => ({ id, title:id, position:{x,y:0}, gridSize:{columns:1,rows:1}, tileType:kind, ...(kind==='dirt'?{travelCards:7}:{}), unlocked:true, flags:[] });
const plan = () => planTravel('hero', [{x:0,y:0,pace:0},{x:144,y:0,pace:1}], [tile('dirt',48,'dirt'),tile('berries',96,'berry-patch'),tile('forest',144,undefined)]);
const base = () => { const s=createInitialState(); return {...s,travelStamina:24, biomeTiles:[...s.biomeTiles, ...plan().segments.map((seg,i)=>({...s.biomeTiles[0],id:seg.tileId!,position:{x:(i+1)*48,y:0},traversalProgress:0,flags:['unexplored' as const]}))], journey:beginJourney(plan())}; };
describe('travel journeys', () => {
  it('auto-solves the finite window and reserve using normal travel costs and rewards', () => {
    let state = base();
    while (state.journey.completed < state.journey.cards) {
      if(state.journey.pendingSearch!==undefined){state=discardTravelEvent(state,state.journey.columns.findIndex(c=>c[c.length-1]?.event)) as typeof state;continue;}
      const column = bestTravelMove(state.journey);
      expect(column).not.toBeNull();
      const next = playTravelCard(state, column!) as typeof state;
      expect(next.journey.completed).toBe(state.journey.completed + 1);
      state = next;
    }
    expect(bestTravelMove(state.journey)).toBeNull();
    expect(state.journey.progress).toBe(1);
    expect(state.travelStamina + state.journey.spent).toBeCloseTo(24);
    expect(state.utilityAP?.hero).toBe(31);
  });
  it('seeds 7 + 12 + 12 cards from a simplified route', () => { const p=plan();expect(p.cards).toBe(31);expect(p.estimate).toBe(6);expect(p.segments.map(s=>s.cards)).toEqual([7,12,12]);const j=beginJourney(p);expect(j.columns.flat()).toHaveLength(19);expect(j.reserve).toHaveLength(0);expect(p.segments[1].denseBerry).toBe(true); });
  it('applies actor terrain affinity without changing puzzle work', () => { expect(traversalProfile({...tile('pond',48,undefined),terrain:'water'},{water:.25})).toEqual({kind:'water',difficulty:1,cards:12}); });
  it('rejects paused, invalid and exhausted plays without spending or rewards', () => { const s=base();expect(playTravelCard({...s,journey:{...s.journey,paused:true}},0).travelStamina).toBe(24);expect(playTravelCard({...s,travelStamina:0},0).journey?.completed).toBe(0);expect(playTravelCard(s,100)).toBe(s); });
  it('solves all cards, advances cairns, awards one berry combo and retains fractional costs', () => { let s=base();let plays=0, bonuses=0, harvested=0;while(s.journey.completed<31){if(s.journey.pendingSearch!==undefined){s=discardTravelEvent(s,s.journey.columns.findIndex(c=>c[c.length-1]?.event)) as typeof s;continue;}const i=bestTravelMove(s.journey)!;expect(i).toBeGreaterThanOrEqual(0);const old=s;const column=s.journey.columns[i];harvested+=Number(!!column[column.length-1].foodSource);s=playTravelCard(s,i) as typeof s;expect(s).not.toBe(old);if(s.journey.berries-old.journey.berries>=3) bonuses++;plays++;if(plays===7)expect(s.biomeTiles.find(t=>t.id==='dirt')?.traversalProgress).toBe(0);}expect(plays).toBe(31);expect(s.journey.progress).toBe(1);expect(s.journey.spent).toBeLessThan(s.journey.estimate);expect(s.travelStamina+s.journey.spent).toBeCloseTo(24,10);expect(bonuses).toBe(1);expect(s.journey.berries).toBe(harvested+3);expect(playTravelCard(s,0)).toBe(s); });
  it('redraw breaks the streak and costs Inspiration, never stamina', () => { const s=base();const n=redrawTravel({...s,journey:{...s.journey,streak:7,tileStreak:7}});expect(n.journey?.streak).toBe(0);expect(n.actorInspiration[0]).toBe(s.actorInspiration[0]-1);expect(n.travelStamina).toBe(24); });
  it('gives zero-cost open ground short crossing deals instead of sprinting', () => { const p=planTravel('hero',[{x:0,y:0,pace:0},{x:96,y:0,pace:1}],[]);expect(p.cards).toBe(6);expect(p.estimate).toBe(0);expect(beginJourney(p).progress).toBe(0); });
  it('wraps A–K and rejects equal ranks',()=>{expect(travelPlayable(1,13)).toBe(true);expect(travelPlayable(13,1)).toBe(true);expect(travelPlayable(7,7)).toBe(false);});
});

describe('walked tile paint', () => {
 it('paints at the centre, retains progress, and bounds paint by earned movement', () => {
  const state=base();
  state.biomeTiles=state.biomeTiles.map(t=>({...t,flags:[]}));
  state.journey.progress=1;
  const at=(p:number)=>paintTravelProgress(state,p).biomeTiles.find(t=>t.id==='dirt')!.traversalProgress;
  expect(at(1/6)).toBe(0);
  expect(at(1/3)).toBeCloseTo(.5);
  expect(at(.5)).toBe(1);
  const painted=paintTravelProgress(state,1/3);
  expect(paintTravelProgress(painted,0)).toBe(painted);
  state.journey.progress=1/6;
  expect(at(1)).toBe(0);
 });
});
