import { describe, it, expect } from 'vitest';
import { createInitialState } from './rules/setup';
import { addPartyCompanion, joinParty, leaveParty, partyMembers } from './partySystem';
import { arriveActorAtBiome } from './biomeArrival';
import { adjacentFoundationIndexes } from './rules/play';
import { beginJourney, planTravel, playTravelCard, redrawTravel, checkTravelCairn } from './travelJourney';

const grouped = () => joinParty(addPartyCompanion(createInitialState()), 'glacia', 'hero');
describe('world parties', () => {
 it('joins colocated actors, splits cleanly, and rejects distant joins', () => {
  const state = grouped();
  expect(partyMembers(state,'hero')).toHaveLength(2);
  expect(partyMembers(leaveParty(state,'glacia'),'hero')).toHaveLength(1);
  const distant = {...state,worldActors:state.worldActors.map(a => ({...a,partyId:undefined,position:a.id === 'hero' ? a.position : {x:400,y:400}}))};
  expect(joinParty(distant,'glacia','hero')).toBe(distant);
 });
 it('gives every arriving member a usable foundation on a one-cell deal', () => {
  const state = grouped();
  const tile = state.biomeTiles.find(t => t.id === 'day-one-berries')!;
  const arrived = arriveActorAtBiome(state,'hero',tile.id,tile.position);
  expect(arrived.worldActors.filter(a => a.location === 'foundation')).toHaveLength(2);
  expect(arrived.foundations).toHaveLength(2);
  const first = arrived.tableau.flat().find(c => c.questStep === 0)!;
  expect(adjacentFoundationIndexes(first,arrived)).toEqual([0,1]);
 });
 it('returns the whole party home and retains membership', () => {
  const state = grouped();
  const home = state.biomeTiles.find(t => t.id === 'hero-den')!;
  const next = arriveActorAtBiome(state,'glacia',home.id,home.position);
  expect(next.worldActors.every(a => a.location === 'table' && a.position.x === home.position.x && a.position.y === home.position.y)).toBe(true);
  expect(partyMembers(next,'hero')).toHaveLength(2);
 });
 it('plays to a companion without changing leader rank or awarding duplicate AP', () => {
  const state = grouped();
  const plan = planTravel('hero',[{x:0,y:96,pace:0},{x:0,y:48,pace:1}],state.biomeTiles);
  const journey = {...beginJourney(plan),memberRanks:{hero:2,glacia:5},columns:[[{id:'companion-only',rank:6,segment:0,kind:'dirt'}]],reserve:[]};
  const traveling = {...state,journey};
  expect(playTravelCard(traveling,0,'hero')).toBe(traveling);
  const next = playTravelCard(traveling,0,'glacia');
  expect(next.journey?.memberRanks).toEqual({hero:2,glacia:6});
  expect(next.utilityAP?.glacia).toBe(1);
  expect(next.utilityAP?.hero ?? 0).toBe(0);
  expect(next.journey?.columns.flat().filter(card=>!card.event)).toHaveLength(0);
  expect(playTravelCard(next,0,'glacia')).toBe(next);
  expect(joinParty(traveling,'glacia','hero')).toBe(traveling);
  expect(leaveParty(traveling,'glacia')).toBe(traveling);
 });
 it('redraws only the selected member and moves the whole party at cairns', () => {
  const state = grouped();
  const journey = {...beginJourney(planTravel('hero',[{x:0,y:96,pace:0},{x:0,y:48,pace:1}],state.biomeTiles)),memberRanks:{hero:2,glacia:5}};
  const traveling = {...state,journey};
  const next = redrawTravel(traveling,'glacia');
  expect(next.actorInspiration[1]).toBe(state.actorInspiration[1]-1);
  expect(next.actorInspiration[0]).toBe(state.actorInspiration[0]);
  expect(next.journey?.memberRanks?.hero).toBe(2);
  const moved = checkTravelCairn(traveling,1);
  expect(moved.worldActors.every(a => a.position.y === 48)).toBe(true);
 });
});
