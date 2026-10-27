import { describe,it,expect,vi } from 'vitest';
// Exercise retained scaffolding explicitly; live gameplay keeps events off.
vi.mock('./tableauFeatures', () => ({ EVENT_CARDS_ENABLED: true }));
import { eventPlayCost, MOON_FRUIT_EVENT, spawnTableauEvent, type TableauEvent } from './eventCards';
import { beginJourney,bestTravelMove,prepareTravelTableau,travelTableauHeld,planTravel,playTravelCard,playTravelEvent,discardTravelEvent,travelEventCost,SEARCH_STAMINA } from './travelJourney';
import { createInitialState,createExplorationFoundations } from './rules/setup';
import { applyFoundationPlay,discardTableauEvent } from './rules/play';
import type { Card,ProtoState } from './protoState';

const event=(solutions:TableauEvent['solutions']=[{type:'wildcard'}]):Card=>({id:'test-event',rank:9,event:{id:'test',title:'TEST',description:'A test event',solutions,effect:{type:'resource',resource:'wood',amount:1}}});
const access={rank:2,depth:1,ap:5,partyCharacteristics:[] as string[]};
const travel=():ProtoState=>{
  const state=createInitialState(false);
  const path=[{x:0,y:0,pace:0},{x:48,y:0,pace:1}];
  return {...state,biomeTiles:[],worldActors:[{id:'hero',label:'Hero',location:'table',position:path[0]}],
    journey:beginJourney(planTravel('hero',path,[]))};
};
const cross=(initial:ProtoState)=>{let state=initial;for(let i=0;i<3;i++)state=playTravelCard(state,bestTravelMove(state.journey!)!);return state;};
const eventColumn=(state:ProtoState)=>state.journey!.columns.findIndex(c=>c[c.length-1]?.event);
const finishSearch=(initial:ProtoState)=>{let state=initial;while(state.journey?.search){const i=bestTravelMove(state.journey)!;expect(i).not.toBeNull();const next=playTravelCard(state,i);expect(next).not.toBe(state);state=next;}return state;};

describe('event card solutions',()=>{
  it('accepts wildcards on any exposed foundation without relaxing covered-card rules',()=>{
    expect(eventPlayCost(event(),access)).toBe(0);expect(eventPlayCost(event(),{...access,depth:2})).toBeNull();
  });
  it('keeps rank events legal, supports A–K wrapping, and requires explicitly allowed utilities',()=>{
    const card=event([{type:'rank'}]);expect(eventPlayCost(card,access)).toBeNull();
    expect(eventPlayCost(card,{...access,rank:8})).toBe(0);
    expect(eventPlayCost({...card,rank:13},{...access,rank:1})).toBe(0);
    expect(eventPlayCost(card,{...access,utility:'Fetch'})).toBeNull();
    card.event!.solutions.push({type:'utility',moves:['Fetch','Dig']});
    expect(eventPlayCost(card,{...access,utility:'Fetch'})).toBe(2);
    expect(eventPlayCost(card,{...access,depth:3,utility:'Fetch'})).toBeNull();
    expect(eventPlayCost(card,{...access,depth:3,utility:'Dig'})).toBe(3);
    expect(eventPlayCost(card,{...access,depth:3,ap:2,utility:'Dig'})).toBeNull();
  });
  it('supports characteristic-only events without treating wildcard or Dig as a bypass',()=>{
    const card={...event(),event:MOON_FRUIT_EVENT};
    expect(eventPlayCost(card,access)).toBeNull();expect(eventPlayCost(card,{...access,utility:'Dig'})).toBeNull();
    for(const characteristic of ['treeClimber','#lumberjack','flight'])expect(eventPlayCost(card,{...access,partyCharacteristics:[characteristic]})).toBe(0);
    expect(eventPlayCost(card,{...access,depth:2,partyCharacteristics:['flight']})).toBeNull();
  });
  it('spawns a visible covered event without deleting its neighbours',()=>{
    const columns=[[{id:'a',rank:2},{id:'b',rank:3}]];
    const result=spawnTableauEvent(columns,event(),0,1);
    expect(result[0].map(c=>c.id)).toEqual(['a','test-event','b']);expect(columns[0]).toHaveLength(2);
  });
});

describe('easy crossings and optional SEARCH',()=>{
  it('offers an event before crossing work and leaves legal rank plays and combos available',()=>{
    const offered=prepareTravelTableau(travel());
    expect(offered.journey?.pendingSearch).toBe(0);expect(offered.journey?.completed).toBe(0);expect(offered.journey?.progress).toBe(0);
    expect(travelTableauHeld(offered.journey!)).toBe(false);
    const column=bestTravelMove(offered.journey!);expect(column).not.toBeNull();
    const next=playTravelCard(offered,column!);
    expect(next.journey?.completed).toBe(1);expect(next.journey?.streak).toBe(1);expect(next.utilityAP?.hero).toBe(1);
    expect(next.journey?.pendingSearch).toBe(0);expect(next.journey?.columns.flat().some(c=>c.event)).toBe(true);
  });
  it('holds only the event tile boundary, then releases the next deal on discard',()=>{
    const initial=travel();initial.journey=beginJourney(planTravel('hero',[{x:0,y:0,pace:0},{x:96,y:0,pace:1}],[]));
    const held=cross(prepareTravelTableau(initial));
    expect(held.journey?.progress).toBe(.5);expect(held.journey?.completed).toBe(3);expect(travelTableauHeld(held.journey!)).toBe(true);
    const cardColumn=held.journey!.columns.findIndex(c=>c[c.length-1]&&!c[c.length-1].event);
    expect(playTravelCard(held,cardColumn)).toBe(held);
    const released=discardTravelEvent(held,eventColumn(held));
    expect(released.journey?.completed).toBe(3);expect(released.journey?.progress).toBe(.5);
    expect(released.journey?.pendingSearch).toBe(1);expect(travelTableauHeld(released.journey!)).toBe(false);
    const next=playTravelCard(released,bestTravelMove(released.journey!)!);
    expect(next.journey?.completed).toBe(4);expect(next.journey!.progress).toBeGreaterThan(.5);
  });
  it('can resolve SEARCH before clearing the normal cards without skipping or replaying their work',()=>{
    let state=prepareTravelTableau(travel());state=playTravelCard(state,bestTravelMove(state.journey!)!);
    const i=eventColumn(state),row=state.journey!.columns[i].length-1;
    const finished=finishSearch(playTravelEvent(state,i,row,'hero'));
    expect(finished.journey?.completed).toBe(1);expect(finished.journey?.progress).toBeCloseTo(1/3);
    expect(finished.journey?.columns.flat().filter(c=>!c.event)).toHaveLength(2);
    expect(finished.journey?.streak).toBe(5);expect(finished.haul.mana).toBe(1);
  });
  it('keeps SEARCH inside the 28-card window and restores the exact finite inventory',()=>{
    const state=travel();state.journey=beginJourney(planTravel('hero',[{x:0,y:0,pace:0},{x:480,y:0,pace:1}],[]));
    const initialIds=[...state.journey.columns.flat(),...state.journey.reserve].map(c=>c.id);
    const offered=cross(state),j=offered.journey!;
    expect(j.columns.flat().length).toBeLessThanOrEqual(28);
    const declined=discardTravelEvent(offered,eventColumn(offered));
    const remaining=[...declined.journey!.columns.flat(),...declined.journey!.reserve].filter(c=>!c.event).map(c=>c.id);
    expect(remaining.sort()).toEqual(initialIds.filter(id=>!declined.journey!.completedCardIds!.includes(id)).sort());
  });
  it('requires three plays on free ground and offers SEARCH without spending or farming AP',()=>{
    const state=cross(travel());expect(state.journey?.completed).toBe(3);expect(state.journey?.progress).toBe(1);
    expect(state.journey?.pendingSearch).toBe(0);expect(state.travelStamina??24).toBe(24);expect(state.utilityAP?.hero).toBe(3);
    expect(bestTravelMove(state.journey!)).toBeNull();expect(playTravelCard(state,0)).toBe(state);
  });
  it('discards without changing rank, stamina, streak or resources',()=>{
    const state=cross(travel()),next=discardTravelEvent(state,eventColumn(state));
    expect(next.journey?.pendingSearch).toBeUndefined();expect(next.eventDiscard).toHaveLength(1);
    expect(next.journey?.rank).toBe(state.journey?.rank);expect(next.journey?.streak).toBe(3);expect(next.haul).toEqual(state.haul);
    expect(next.travelStamina).toBe(state.travelStamina);expect(discardTravelEvent(next,0)).toBe(next);
  });
  it('commits extra stamina once, preserves rank, extends combos and pays one finite reward',()=>{
    const state=cross(travel()),i=eventColumn(state),row=state.journey!.columns[i].length-1;
    const searching=playTravelEvent(state,i,row,'hero');
    expect(searching.travelStamina).toBe(24-SEARCH_STAMINA);expect(searching.journey?.rank).toBe(state.journey?.rank);
    expect(searching.journey?.search?.remaining).toBe(4);expect(searching.utilityAP?.hero).toBe(3);
    const finished=finishSearch(searching);expect(finished.haul.mana-state.haul.mana).toBe(1);
    expect(finished.journey?.streak).toBe(7);expect(finished.journey?.completed).toBe(3);expect(finished.utilityAP?.hero).toBe(7);
    expect(finished.journey?.spent).toBe(SEARCH_STAMINA);expect(playTravelEvent(finished,i,row,'hero')).toBe(finished);
  });
  it('prevents exhausted, paused, forged receiver and duplicate event activation',()=>{
    const state=cross(travel()),i=eventColumn(state),row=state.journey!.columns[i].length-1;
    const empty={...state,travelStamina:1};expect(playTravelEvent(empty,i,row,'hero')).toBe(empty);
    expect(travelEventCost(state,i,row,'not-in-party')).toBeNull();
    const paused={...state,journey:{...state.journey!,paused:true}};expect(playTravelEvent(paused,i,row,'hero')).toBe(paused);
    const replay={...state,resolvedEventIds:[state.journey!.columns[i][row].id]};expect(playTravelEvent(replay,i,row,'hero')).toBe(replay);
  });
  it('does not refresh SEARCH, AP, mastery or pickups on same-day revisits; a new day refreshes them',()=>{
    const crossed=cross(travel()),first=finishSearch(playTravelEvent(crossed,eventColumn(crossed),crossed.journey!.columns[eventColumn(crossed)].length-1,'hero'));
    const repeat=cross({...first,journey:beginJourney(planTravel('hero',[{x:0,y:0,pace:0},{x:48,y:0,pace:1}],[]))});
    expect(repeat.journey?.pendingSearch).toBeUndefined();expect(repeat.utilityAP).toEqual(first.utilityAP);expect(repeat.terrainCrossings).toEqual(first.terrainCrossings);expect(repeat.haul).toEqual(first.haul);
    const tomorrow=cross({...repeat,day:repeat.day+1,journey:beginJourney(planTravel('hero',[{x:0,y:0,pace:0},{x:48,y:0,pace:1}],[]))});
    expect(tomorrow.journey?.pendingSearch).toBe(0);expect(tomorrow.utilityAP?.hero).toBe(first.utilityAP!.hero+3);expect(tomorrow.terrainCrossings?.path).toBe(2);
  });
  it('uses party characteristics and utility AP for covered travel events',()=>{
    const state=travel(),card={...event([{type:'utility',moves:['Dig']}]),segment:0,kind:'path'};
    state.journey!.columns=[[card,{id:'cover',rank:3,segment:0,kind:'path'}]];state.utilityAP={hero:3};
    expect(travelEventCost(state,0,0,'hero')).toBeNull();expect(travelEventCost(state,0,0,'hero','Dig')).toBe(2);
    const next=playTravelEvent(state,0,0,'hero','Dig');expect(next.utilityAP?.hero).toBe(1);expect(next.haul.wood-state.haul.wood).toBe(1);expect(next.journey?.columns[0].map(c=>c.id)).toEqual(['cover']);
    const trait=travel();trait.worldActors[0].characteristics=['flight'];trait.journey!.columns=[[{...event(),event:MOON_FRUIT_EVENT,segment:0,kind:'path'}]];
    expect(playTravelEvent(trait,0,0,'hero').haul.mana-trait.haul.mana).toBe(1);
  });
  it('accepts a characteristic supplied by another current party member',()=>{
    const state=travel();state.worldActors[0].partyId='group';
    state.worldActors.push({id:'glacia',label:'Glacia',location:'table',position:{x:0,y:0},partyId:'group',characteristics:['#treeClimber']});
    state.journey!.memberRanks={hero:2,glacia:5};state.journey!.columns=[[{...event(),event:MOON_FRUIT_EVENT,segment:0,kind:'path'}]];
    expect(playTravelEvent(state,0,0,'hero').haul.mana-state.haul.mana).toBe(1);
    const departed={...state,worldActors:state.worldActors.map(a=>a.id==='glacia'?{...a,partyId:undefined}:a)};
    expect(playTravelEvent(departed,0,0,'hero')).toBe(departed);
  });
});

describe('events in ordinary tableau rules',()=>{
  const fixture=():ProtoState=>({...createInitialState(false),selectedBiomeId:'test',tableau:[[event()]],stock:[],
    foundations:createExplorationFoundations([{id:'f',rank:2}],1),worldActors:[{id:'hero',label:'Hero',location:'foundation',biomeId:'test',foundationIndex:0,position:{x:0,y:0}}],utilityAP:{hero:5}});
  it('invokes wildcard events without changing rank, awarding work AP, or duplicating rewards',()=>{
    const state=fixture(),next=applyFoundationPlay(state,{columnIndex:0,foundationIndex:0})!.state;
    expect(next.haul.wood-state.haul.wood).toBe(1);expect(next.foundations[0]?.card.rank).toBe(2);expect(next.utilityAP?.hero).toBe(5);expect(next.totalWorkCompleted).toBe(state.totalWorkCompleted);
    expect(applyFoundationPlay({...next,tableau:state.tableau},{columnIndex:0,foundationIndex:0})).toBeNull();
  });
  it('discards exposed events without executing them or respawning resources',()=>{
    const state=fixture(),next=discardTableauEvent(state,0);expect(next.haul).toEqual(state.haul);expect(next.eventDiscard?.[0].event?.title).toBe('TEST');expect(next.tableau[0]).toHaveLength(0);
    const buried={...state,tableau:[[event(),{id:'cover',rank:3}]]};expect(discardTableauEvent(buried,0)).toBe(buried);
  });
});
