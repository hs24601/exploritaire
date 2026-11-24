import { describe,it,expect } from 'vitest';
import { authoredLayouts, dealLayout, validateLayouts } from './tableauLayouts';
import { beginJourney, prepareTravelTableau, playTravelCard, planTravel } from './travelJourney';
import { createInitialState } from './rules/setup';
describe('tableau authoring',()=>{
 it('validates source and rejects ambiguous stacks and dangling assignments',()=>{expect(()=>validateLayouts(authoredLayouts)).not.toThrow();const d=structuredClone(authoredLayouts);d.layouts[0].cards[1].order=0;expect(()=>validateLayouts(d)).toThrow();d.layouts[0].cards[1].order=1;d.assignments.woods='missing';expect(()=>validateLayouts(d)).toThrow();});
 it('reproduces random ranks and retains fixed values and stack ordering',()=>{const l=structuredClone(authoredLayouts.layouts[0]);l.cards[0].rank='random';expect(dealLayout(l,17)).toEqual(dealLayout(l,17));expect(dealLayout(l,17)[0][1].rank).toBe(4);expect(dealLayout(l,17)[0][0].rank).not.toBe(dealLayout(l,18)[0][0].rank);});
 it('isolates custom deals, preserves coverage and completes finite travel without extra rewards',()=>{
  const s=createInitialState();const p=planTravel('hero',[{x:0,y:0,pace:0},{x:48,y:0,pace:1}],[]);p.segments[0]={...p.segments[0],cards:6,layout:structuredClone(authoredLayouts.layouts[0]),stamina:2,sparseBerry:false};p.cards=6;p.estimate=2;
  let state=prepareTravelTableau({...s,travelStamina:24,journey:beginJourney(p)});expect(state.journey?.columns.map(c=>c.map(c=>c.rank))).toEqual([[5,4],[2],[3,3],[6]]);
  const poses=JSON.stringify(state.journey?.columns.flat().map(c=>c.pose));
  for(const col of [2,1,2,0,0,3])state=playTravelCard(state,col);
  expect(state.journey?.completed).toBe(6);expect(state.journey?.passageStage).toBeUndefined();expect(state.journey?.columns.flat()).toHaveLength(0);expect(state.utilityAP?.hero).toBe(6);expect(state.journey?.spent).toBeLessThanOrEqual(2);expect(poses).toContain('rotation');expect(playTravelCard(state,0)).toBe(state);
 });
});

it('pays the sparse harvest once on completion of an assigned deal',()=>{
 const base=createInitialState();const tile={...base.biomeTiles[0],id:'layout-berries',tileType:'berry-patch' as const,berryPatchVariant:'sparse' as const,berryHarvested:false,flags:[],position:{x:48,y:0},gridSize:{columns:1,rows:1}};
 const p=planTravel('hero',[{x:0,y:0,pace:0},{x:48,y:0,pace:1}],[tile]);p.segments[0]={...p.segments[0],cards:6,layout:structuredClone(authoredLayouts.layouts[0])};p.cards=6;
 let state=prepareTravelTableau({...base,biomeTiles:[tile],travelStamina:24,journey:beginJourney(p)});
 for(const col of [2,1,2,0,0])state=playTravelCard(state,col);
 expect(state.haul.mana).toBe(base.haul.mana);state=playTravelCard(state,3);expect(state.haul.mana).toBe(base.haul.mana+1);expect(state.biomeTiles[0].berryHarvested).toBe(true);expect(playTravelCard(state,3)).toBe(state);
});
