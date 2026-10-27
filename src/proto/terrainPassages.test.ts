import { describe,it,expect,afterEach } from 'vitest';
import { createInitialState } from './rules/setup';
import { assignMove } from './actorLoadouts';
import { findGridPath, type CellCost } from './gridPathfinding';
import { routeThroughTravelCells } from './travelRouting';
import { passageStepAllowed } from './terrainPassages';
import { bestTravelMove,beginJourney,planTravel,prepareTravelTableau,breachTravelPassage,playTravelCard,redrawTravel,checkTravelCairn } from './travelJourney';
import { authorTile, validateTileDocument } from './tileEditor/schema';
import { SAVED_TILE_DOCUMENT, materializeTiles } from './tileEditor/runtime';
import type { ProtoState } from './protoState';

function fixture():ProtoState {
  const s=createInitialState();
  const tile={...s.biomeTiles[0],id:'gate',title:'Mountain',position:{x:48,y:0},gridSize:{columns:1,rows:1},tileType:'impassable-mountain' as const,flags:['impassable' as const],unlocked:true,travelCards:14,traversalDifficulty:3,
    passage:{axis:'east-west' as const,title:'Hastily Buried Trapdoor',tags:['buried'],columns:7,breachAP:1}};
  s.biomeTiles=[tile];s.worldActors=[{id:'hero',label:'Hero',location:'table',position:{x:0,y:0}}];s.utilityAP={hero:3};s.travelStamina=24;
  s.journey=beginJourney(planTravel('hero',[{x:0,y:0,pace:0},{x:96,y:0,pace:1}],s.biomeTiles));
  return prepareTravelTableau(s);
}
afterEach(()=>assignMove('hero','Dig',false));
describe('staged directional terrain passages',()=>{
  it('shows only one obstruction and blocks ordinary plays, resets and solver for any rank',()=>{
    const s=fixture();expect(s.journey?.columns.map(c=>c.length)).toEqual([1]);
    const party={...s,journey:{...s.journey!,memberRanks:{hero:1,mochi:3},rank:1}};
    expect(playTravelCard(party,0)).toBe(party);expect(redrawTravel(party)).toBe(party);expect(bestTravelMove(party.journey)).toBeNull();
  });
  it('cannot spend later-tile cards against an unprepared passage',()=>{
    const s=fixture();s.journey=beginJourney(planTravel('hero',s.journey!.path,s.biomeTiles));
    expect(bestTravelMove(s.journey)).toBeNull();expect(redrawTravel(s)).toBe(s);
    const next=playTravelCard(s,0);expect(next.journey?.obstruction).toBeDefined();expect(next.journey?.completed).toBe(0);expect(next.travelStamina).toBe(s.travelStamina);
  });
  it('requires an assigned matching capability, party member, AP and active journey',()=>{
    const s=fixture();expect(breachTravelPassage(s,'hero','Dig')).toBe(s);
    assignMove('hero','Nip',false);assignMove('hero','Dig',true);
    expect(breachTravelPassage(s,'hero','Fetch')).toBe(s);expect(breachTravelPassage(s,'stranger','Dig')).toBe(s);
    const poor={...s,utilityAP:{hero:0}};expect(breachTravelPassage(poor,'hero','Dig')).toBe(poor);
    const paused={...s,journey:{...s.journey!,paused:true}};expect(breachTravelPassage(paused,'hero','Dig')).toBe(paused);
  });
  it('opens seven columns without movement/rewards; solves crossing then restores ordinary travel',()=>{
    let s=fixture();assignMove('hero','Nip',false);assignMove('hero','Dig',true);
    const before=s;s=breachTravelPassage(s,'hero','Dig');
    expect(s.utilityAP?.hero).toBe(2);expect(s.biomeTiles[0].passageOpen).toBe(true);expect(s.journey?.columns).toHaveLength(7);
    expect(s.journey?.columns.flat()).toHaveLength(14);expect(s.journey?.progress).toBe(before.journey?.progress);expect(s.journey?.rank).toBe(before.journey?.rank);expect(s.haul).toEqual(before.haul);expect(s.travelStamina).toBe(before.travelStamina);expect(s.journey?.streak).toBe(0);
    expect(breachTravelPassage(s,'hero','Dig')).toBe(s);
    for(let i=0;i<17;i++){const col=bestTravelMove(s.journey!);expect(col).not.toBeNull();s=playTravelCard(s,col!);}
    expect(s.journey?.progress).toBe(1);expect(s.journey?.completed).toBe(17);expect(s.utilityAP?.hero).toBe(19);
    const reverse=prepareTravelTableau({...s,journey:beginJourney(planTravel('hero',[{x:96,y:0,pace:0},{x:0,y:0,pace:1}],s.biomeTiles))});
    expect(reverse.journey?.obstruction).toBeUndefined();expect(reverse.journey?.columns).toHaveLength(7);
  });
  it('enforces both faces in routing and explicit waypoints, opened or closed; hides unknown geometry',()=>{
    const s=fixture(), tiles=s.biomeTiles;
    const cost:CellCost=(x,y)=>Math.abs(x)>2||Math.abs(y)>2?Infinity:1;
    cost.canStep=(...args)=>passageStepAllowed(tiles,...args);
    expect(findGridPath({x:0,y:0},{x:96,y:0},cost,48)).toHaveLength(2);
    expect(passageStepAllowed(tiles,1,-1,1,0)).toBe(false);expect(passageStepAllowed(tiles,1,0,1,1)).toBe(false);
    expect(routeThroughTravelCells({x:48,y:-48},{x:48,y:48},[{x:48,y:0}],cost)?.some(p=>p.x!==48)).toBe(true);
    const hidden=tiles.map(t=>({...t,flags:['unexplored' as const]}));expect(passageStepAllowed(hidden,1,-1,1,0)).toBe(true);
    const north=tiles.map(t=>({...t,passage:{...t.passage!,axis:'north-south' as const}}));expect(passageStepAllowed(north,1,-1,1,0)).toBe(true);expect(passageStepAllowed(north,0,0,1,0)).toBe(false);
  });
  it('refreshes a newly discovered passage into an obstruction before entry',()=>{
    const s=fixture();s.biomeTiles[0].flags=['impassable','unexplored'];
    s.journey=beginJourney(planTravel('hero',[{x:0,y:0,pace:0},{x:96,y:0,pace:1}],s.biomeTiles));
    expect(s.journey.segments[0].passage).toBeUndefined();
    const n=checkTravelCairn(s,0);expect(n.journey?.blocked).toBeUndefined();expect(n.journey?.obstruction?.title).toBe('Hastily Buried Trapdoor');expect(n.travelStamina).toBe(24);expect(n.worldActors[0].position).toEqual({x:0,y:0});
  });
  it('serializes passage authoring but never session breaches; validates and preserves unchanged live breaches',()=>{
    validateTileDocument(SAVED_TILE_DOCUMENT);
    const tiles=materializeTiles(SAVED_TILE_DOCUMENT,createInitialState().biomeTiles);
    const tile=tiles.find(t=>t.passage)!;tile.passageOpen=true;
    expect(authorTile(tile)).not.toHaveProperty('passageOpen');expect(authorTile(tile).passage).toEqual(tile.passage);
    expect(materializeTiles(SAVED_TILE_DOCUMENT,tiles).find(t=>t.id===tile.id)?.passageOpen).toBe(true);
    expect(materializeTiles(SAVED_TILE_DOCUMENT,tiles,false).find(t=>t.id===tile.id)?.passageOpen).toBeUndefined();
    const bad=structuredClone(SAVED_TILE_DOCUMENT);bad.tiles!.find(t=>t.passage)!.passage!.columns=0;
    expect(()=>validateTileDocument(bad)).toThrow();
  });
});
