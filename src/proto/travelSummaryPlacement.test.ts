import { describe, expect, it } from 'vitest';
import { placeTravelSummary, routeCrossesBox } from './travelSummaryPlacement';
describe('travel confirmation free space',()=>{
  it('detects crossing lines even when both endpoints lie outside the panel',()=>{
    expect(routeCrossesBox({x:0,y:50},{x:400,y:50},{left:100,top:20,right:200,bottom:80})).toBe(true);
    expect(routeCrossesBox({x:0,y:0},{x:90,y:90},{left:100,top:20,right:200,bottom:80})).toBe(false);
  });
  it('finds space above a route when the destination is on the bottom edge',()=>{
    const position=placeTravelSummary({width:390,height:300},{width:190,height:90},{x:195,y:270},[{x:10,y:270},{x:380,y:270}],
      [{left:169,top:244,right:221,bottom:296}])!;
    expect(position).not.toBeNull();expect(position.y+90).toBeLessThan(244);
    expect(position.x).toBeGreaterThanOrEqual(8);expect(position.x+190).toBeLessThanOrEqual(382);
  });
  it('searches beyond the destination neighbourhood to avoid multiple legs and nodes',()=>{
    const route=[{x:50,y:150},{x:350,y:150},{x:350,y:250},{x:50,y:250}];
    const obstacles=route.map(p=>({left:p.x-26,top:p.y-26,right:p.x+26,bottom:p.y+26}));
    const position=placeTravelSummary({width:400,height:400},{width:190,height:90},route[3],route,obstacles)!;
    expect(position).not.toBeNull();
    const box={left:position.x-12,top:position.y-12,right:position.x+202,bottom:position.y+102};
    expect(route.slice(1).some((p,i)=>routeCrossesBox(route[i],p,box))).toBe(false);
  });
});
