import { expect, it } from 'vitest';
import { findWorldPath, crossesObstacle, worldPathLength, pointAlongWorldPath, type PathObstacle } from './worldPathfinding';
const solid:PathObstacle={id:'biome',left:40,right:100,top:30,bottom:100};
it('takes direct diagonal routes and preserves fractional destinations',()=>{
  expect(findWorldPath({x:0,y:0},{x:33.5,y:41.25},[])).toEqual([{x:0,y:0},{x:33.5,y:41.25}]);
});
it('routes around a footprint with clearance rather than through it',()=>{
  const path=findWorldPath({x:0,y:50},{x:150,y:50},[solid])!;
  expect(path.length).toBeGreaterThan(2);
  const inflated={...solid,left:12,right:128,top:2,bottom:128};
  for(let i=1;i<path.length;i++)expect(crossesObstacle(path[i-1],path[i],inflated)).toBe(false);
  expect(path[path.length-1]).toEqual({x:150,y:50});
});
it('allows deliberate entry only at the final segment',()=>{
  expect(findWorldPath({x:-50,y:60},{x:60,y:60},[solid])).toBeNull();
  const path=findWorldPath({x:-50,y:60},{x:60,y:60},[solid],'biome')!;
  expect(path[path.length-1]).toEqual({x:60,y:60});
  expect(crossesObstacle(path[path.length-2]!,path[path.length-1]!,solid)).toBe(true);
});
it('exits an occupied biome then avoids another obstacle',()=>{
  const other={id:'hut',left:140,right:180,top:30,bottom:100};
  const path=findWorldPath({x:60,y:60},{x:240,y:70},[solid,other])!;
  for(let i=1;i<path.length;i++)expect(crossesObstacle(path[i-1],path[i],other)).toBe(false);
});
it('advances at constant speed across unequal segments',()=>{
  const path=[{x:0,y:0},{x:30,y:40},{x:130,y:40}];
  expect(worldPathLength(path)).toBe(150);
  expect(pointAlongWorldPath(path,0.5)).toEqual({x:55,y:40});
});
