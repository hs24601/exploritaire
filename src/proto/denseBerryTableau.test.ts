import {describe,it,expect} from 'vitest';
import {dealDenseBerries,travelCardPlayable,bestDenseBerryMove} from './denseBerryTableau';
import {beginJourney,planTravel,playTravelCard,bestTravelMove,redrawTravel} from './travelJourney';
import {createDayOneState} from './dayScenarios';

describe('denser berry traversal',()=>{
  it('uses explicit match, step and skip rules including A–K wrapping',()=>{
    expect(travelCardPlayable({rank:6,sequenceRule:'match'},6)).toBe(true);
    expect(travelCardPlayable({rank:7,sequenceRule:'match'},6)).toBe(false);
    expect(travelCardPlayable({rank:8,sequenceRule:'skip'},6)).toBe(true);
    expect(travelCardPlayable({rank:7,sequenceRule:'skip'},6)).toBe(false);
    expect(travelCardPlayable({rank:1,sequenceRule:'skip'},12)).toBe(true);
    expect(travelCardPlayable({rank:12,sequenceRule:'skip'},1)).toBe(true);
    expect(travelCardPlayable({rank:6},6)).toBe(false);
  });
  it('can clear all twelve cards from every possible starting rank',()=>{
    for(let rank=1;rank<=13;rank++){
      let journey={...beginJourney({actorId:'hero',path:[],segments:[],cards:12,estimate:0,arrival:{}}),columns:dealDenseBerries(rank,0),rank};
      expect(new Set(journey.columns.flat().map(c=>c.sequenceRule)).size).toBe(3);
      for(let count=0;count<12;count++){
        const column=bestDenseBerryMove(journey);expect(column).not.toBeNull();
        const card=journey.columns[column!][journey.columns[column!].length-1]!;expect(travelCardPlayable(card,journey.rank)).toBe(true);
        journey={...journey,rank:card.rank,columns:journey.columns.map((c,i)=>i===column?c.slice(0,-1):c)};
      }
      expect(journey.columns.flat()).toHaveLength(0);
    }
  });
  it('resets to a legal receiving rank for both matching and skipping',()=>{
    for(const sequenceRule of ['match','skip'] as const){
      const base=createDayOneState();
      const journey=beginJourney({actorId:'hero',path:[],segments:[],cards:1,estimate:0,arrival:{}});
      const card={id:'recovery',rank:8,sequenceRule,segment:0,kind:'berry-patch'};
      const state={...base,actorInspiration:[2],journey:{...journey,rank:2,columns:[[card]]}};
      const reset=redrawTravel(state);
      expect(reset.actorInspiration[0]).toBe(1);
      expect(travelCardPlayable(card,reset.journey!.rank)).toBe(true);
      expect(reset.travelStamina).toBe(state.travelStamina);
    }
  });
  it('executes real traversal rules without granting forage berries, and resets to a legal rule',()=>{
    let state=createDayOneState();
    const tile=state.biomeTiles.find(t=>t.id===state.dayScenarioTiles?.patchId)!;
    const path=[{x:tile.position.x,y:tile.position.y+48,pace:1},{...tile.position,pace:1}];
    const plan=planTravel('hero',path,[tile]);expect(plan.segments[0].denseBerry).toBe(true);
    state={...state,journey:beginJourney(plan,6,false)};
    expect(state.journey!.columns.flat()).toHaveLength(12);
    const mana=state.haul.mana,stamina=state.travelStamina!;
    // Reset must honor = / ±2 as well as normal adjacent cards.
    state=redrawTravel({...state,actorInspiration:[2,...state.actorInspiration.slice(1)]});
    expect(state.journey!.columns.some(c=>c.length && travelCardPlayable(c[c.length-1]!,state.journey!.rank))).toBe(true);
    for(let count=0;count<12;count++){
      const column=bestTravelMove(state.journey!);expect(column).not.toBeNull();
      const before=state;state=playTravelCard(state,column!);expect(state).not.toBe(before);
    }
    expect(state.journey!.completed).toBe(12);expect(state.haul.mana).toBe(mana);
    expect(state.travelStamina).toBeLessThan(stamina);
    expect(state.biomeTiles.find(t=>t.id===tile.id)?.tableau).toEqual(tile.tableau);
  });
});
