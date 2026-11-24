import {describe,it,expect} from 'vitest';
import {CastleBridgePuzzle,PLANK_PACKS,BRIDGE_CARD_WIDTH,BRIDGE_CARD_HEIGHT,BRIDGE_HALF_WIDTH,bridgeCell} from './castleBridgePuzzle';
import {CastleGroundsNavigation,planGroundsRoute} from './castleGroundsNavigation';
import {CastlePlatformMotion} from './castlePlatformMotion';

const solution=[1,2,3,2,2,3,2,1,3,2,1,2];
function collect(model:CastleBridgePuzzle){PLANK_PACKS.forEach((_,i)=>model.collect(i));}
function solve(model:CastleBridgePuzzle){collect(model);solution.forEach((rank,i)=>expect(model.place(i+4,model.inventory.find(card=>card.rank===rank)!.id)).toBe(true));}
describe('spatial wood plank bridge golf',()=>{
  it('builds one pack at a time, keeps prior placements and blocks the unfinished span',()=>{
    const model=new CastleBridgePuzzle();model.collect(0);
    const placeRow=(row:number,ranks:number[])=>ranks.forEach((rank,col)=>expect(model.place(row*4+col,model.inventory.find(card=>card.rank===rank)!.id)).toBe(true));
    placeRow(1,[1,2,3,2]);expect(model.builtSections).toBe(1);expect(model.inventory).toHaveLength(0);
    expect(model.walkable(0,54)).toBe(true);expect(model.walkable(0,48)).toBe(false);
    expect(planGroundsRoute({x:0,z:61},{x:0,z:54},model.walkable)).toBeDefined();
    expect(planGroundsRoute({x:0,z:61},{x:0,z:37},model.walkable)).toBeUndefined();
    model.collect(1);placeRow(2,[2,3,2,1]);expect(model.builtSections).toBe(2);expect(model.filled).toBe(12);
    const hero=new CastlePlatformMotion(0,44,Math.PI,model.surface);
    for(let i=0;i<480;i++)hero.update(1/120,{x:0,z:-1,run:true,crouch:false,jumpPressed:i%60===0,jumpHeld:true,divePressed:false,jumpTier:3});
    expect(hero.z).toBeGreaterThanOrEqual(model.builtEdge+.45-1e-8);expect(model.complete).toBe(false);
    expect(model.undo()).toBe(true);expect(model.builtSections).toBe(1);expect(model.walkable(0,44)).toBe(false);
  });
  it('fits standard 63:88 cards inside the widened physical bridge',()=>{
    expect(BRIDGE_CARD_WIDTH/BRIDGE_CARD_HEIGHT).toBeCloseTo(63/88,12);
    for(let i=0;i<16;i++)expect(Math.abs(bridgeCell(i).x)+BRIDGE_CARD_WIDTH/2).toBeLessThan(BRIDGE_HALF_WIDTH);
    const model=new CastleBridgePuzzle();expect(model.walkable(7,50)).toBe(false);solve(model);expect(model.walkable(7,50)).toBe(true);expect(model.height(7,50)).toBe(.25);
  });
  it('matches the illustrated row and checks every touching edge, not diagonals',()=>{
    const model=new CastleBridgePuzzle();collect(model);
    expect(model.canPlace(4,1)).toBe(true);expect(model.canPlace(4,2)).toBe(false);
    expect(model.canPlace(8,1)).toBe(false);
    const card=model.inventory.find(card=>card.rank===1)!;expect(model.place(4,card.id)).toBe(true);
    expect(model.canPlace(5,2)).toBe(true);expect(model.canPlace(5,3)).toBe(false);
    expect(model.canPlace(9,2)).toBe(false); // diagonal from slot 4 only
    expect(model.place(5,card.id)).toBe(false); // no duplicate use
  });
  it('conserves cards across collection, placement and undo and requires all sixteen positions',()=>{
    const model=new CastleBridgePuzzle();collect(model);expect(model.collect(0)).toBe(false);
    expect(model.inventory).toHaveLength(12);const card=model.inventory.find(card=>card.rank===1)!;
    model.place(4,card.id);expect(model.inventory).toHaveLength(11);expect(model.complete).toBe(false);
    expect(model.undo()).toBe(true);expect(model.inventory).toHaveLength(12);
    solve(model);expect(model.complete).toBe(true);expect(model.inventory).toHaveLength(0);expect(model.undo()).toBe(false);
  });
  it('opens route planning only on full completion without stale cached walkability',()=>{
    const model=new CastleBridgePuzzle(),start={x:0,z:61},goal={x:0,z:37};
    expect(planGroundsRoute(start,goal,model.walkable)).toBeUndefined();
    const navigation=new CastleGroundsNavigation(model.walkable);expect(navigation.setDestination(start,goal)).toBe(false);
    expect(model.walkable(0,50)).toBe(false);expect(model.walkable(20,0)).toBe(false);
    solve(model);expect(model.walkable(0,50)).toBe(true);expect(navigation.setDestination(start,goal)).toBe(true);
  });
  it('blocks a sustained jumping approach before completion, then permits the crossing',()=>{
    const model=new CastleBridgePuzzle();const hero=new CastlePlatformMotion(0,61,Math.PI,model.surface);
    for(let i=0;i<600;i++)hero.update(1/120,{x:0,z:-1,run:true,crouch:false,jumpPressed:i%60===0,jumpHeld:true,divePressed:false,jumpTier:3});
    expect(hero.z).toBeGreaterThanOrEqual(58.45);
    solve(model);
    for(let i=0;i<480;i++)hero.update(1/120,{x:0,z:-1,run:true,crouch:false,jumpPressed:false,jumpHeld:false,divePressed:false});
    expect(hero.z).toBeLessThan(43);
  });
  it('places every temporary pack on a reachable exterior route',()=>{
    const model=new CastleBridgePuzzle();for(const pack of PLANK_PACKS)expect(planGroundsRoute({x:0,z:61},pack,model.walkable)).toBeDefined();
  });
});
