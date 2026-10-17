import type { ProtoState } from './protoState';
import { describe,it,expect } from 'vitest';
import { createInitialState } from './rules/setup';
import { discardTravelEvent,bestTravelMove,beginJourney,planTravel,checkTravelCairn,playTravelCard, traversalProfile } from './travelJourney';
const fixture=()=>{
 const s=createInitialState();
 const mountain: ProtoState['biomeTiles'][number]={...s.biomeTiles[0],id:'hidden-mountain',title:'Secret Mountain',position:{x:96,y:96},tileType:'impassable-mountain' as const,flags:['unexplored' as const,'impassable' as const],unlocked:true};
 const path=[{x:0,y:96,pace:0},{x:48,y:96,pace:1},{x:96,y:96,pace:1},{x:144,y:96,pace:1}];
 return {...s,biomeTiles:[mountain],worldActors:s.worldActors.map(a=>({...a,location:'table' as const,position:path[0]})),journey:beginJourney(planTravel('hero',path,[mountain]))};
};
describe('travel discovery checkpoints',()=>{
 it('blocks fast card play before charging for a hidden mountain',()=>{const s=fixture();let crossed=s;for(let i=0;i<3;i++)crossed=playTravelCard(crossed,bestTravelMove(crossed.journey)!) as typeof crossed;const n=discardTravelEvent(crossed,crossed.journey.columns.findIndex(c=>c[c.length-1]?.event));expect(n.journey?.blocked).toBeDefined();expect(n.journey?.completed).toBe(3);expect(n.journey?.spent).toBe(0);expect(n.haul).toEqual(s.haul);});
 it('resolves newly discovered walkable terrain without leaking its original deal',()=>{const s=fixture();s.biomeTiles[0].tileType='berry-patch';s.biomeTiles[0].flags=['unexplored'];const n=checkTravelCairn(s,1/3);expect(n.journey?.blocked).toBeUndefined();expect(n.journey?.segments.find(seg=>seg.tileId==='hidden-mountain')).toMatchObject({kind:'berry-patch',cards:12,unknown:false});expect(n.journey?.columns.flat().some(c=>c.kind==='berry-patch')).toBe(true);});
 it('automatically loads the next discovered tableau even when its revised estimate exceeds remaining stamina',()=>{
  const s=fixture();s.biomeTiles[0].tileType='berry-patch';s.biomeTiles[0].flags=['unexplored'];s.biomeTiles[0].traversalDifficulty=2;s.travelStamina=1;
  s.journey={...s.journey,rank:8,spent:2,berries:3,streak:6};
  const n=checkTravelCairn(s,1/3);
  expect(n.journey).toMatchObject({paused:false,rank:8,spent:2,berries:3,streak:6});
  expect(n.journey?.blocked).toBeUndefined();
  expect(n.journey?.columns.flat()).toHaveLength(15);
  expect(n.journey?.columns.flat().filter(c=>c.kind==='berry-patch')).toHaveLength(12);
  const playable=n.journey!.columns.findIndex(c=>c[c.length-1]?.rank===9);
  expect(playTravelCard(n,playable).journey?.completed).toBe(1);
 });
 it('uses uniform unknown work regardless of concealed terrain, affinity or locks',()=>{const t=fixture().biomeTiles[0];expect(traversalProfile(t)).toEqual(traversalProfile({...t,tileType:'berry-patch',unlocked:false,travelCards:99,traversalDifficulty:99},{water:.1}));expect(planTravel('hero',fixture().journey.path,[t]).segments[1]).toMatchObject({title:'Unknown terrain',kind:'unexplored',cards:7,stamina:1});});
 it('halts at an adjacent Cairn without entering or charging the mountain',()=>{const s=fixture();const n=checkTravelCairn(s,1/3);expect(n.journey?.blocked?.position).toEqual({x:48,y:96});expect(n.journey?.paused).toBe(true);expect(n.biomeTiles[0].flags).not.toContain('unexplored');expect(n.travelStamina).toBe(s.travelStamina);expect(n.haul).toEqual(s.haul);expect(playTravelCard(n,0)).toBe(n);expect(n.biomeTiles[0].traversalProgress).toBeUndefined();});
 it('retains rewards and expenses, breaks streaks and remains idempotent',()=>{const s={...fixture(),travelStamina:17,haul:{wood:3,mana:4},journey:{...fixture().journey,spent:7,berries:4,streak:9}};const n=checkTravelCairn(s,1/3);expect(n.journey?.spent).toBe(7);expect(n.journey?.berries).toBe(4);expect(n.journey?.streak).toBe(0);expect(checkTravelCairn(n,2/3)).toBe(n);});
 it('does not reveal distant mountains or halt for discovered terrain off-route',()=>{const s=fixture();s.biomeTiles[0].position={x:96,y:144};s.journey.path=[{x:0,y:0,pace:0},{x:144,y:0,pace:1}];s.journey.segments=planTravel('hero',s.journey.path,s.biomeTiles).segments;const n=checkTravelCairn(s,1/3);expect(n.journey?.blocked).toBeUndefined();expect(n.biomeTiles[0].flags).toContain('unexplored');});
 it('blocks newly discovered diagonal corner obstacles',()=>{const s=fixture();s.biomeTiles[0].position={x:96,y:48};s.journey.path=[{x:48,y:48,pace:0},{x:96,y:96,pace:1}];s.journey.segments=planTravel('hero',s.journey.path,s.biomeTiles).segments;expect(checkTravelCairn(s,0).journey?.blocked).toBeDefined();});
});


