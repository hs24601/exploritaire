import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {fitWorldGridCard,worldGridPoint,WORLD_GRID_CARD,WORLD_GRID_FIELD,worldGridBoundary,worldGridTiles,gridPolygonArea,worldGridTileGeometry,worldGridCoordinate,worldGridIndexAt,worldGridStandPoint,GRID_DOWN,GRID_RIGHT} from './worldCombatGridLayout';
import {createWorldGridJump} from './worldGridJump';
describe('terrain combat cards',()=>{
 it('places Hero on the centerline just above the middle value',()=>{
  const index=136,center=worldGridPoint(10*104*.67,7*142*.67),stand=worldGridStandPoint(index),offset=stand.clone().sub(center);expect(offset.dot(GRID_RIGHT)).toBeCloseTo(0);expect(offset.dot(GRID_DOWN)).toBeCloseTo(-WORLD_GRID_CARD.height*.22);expect(worldGridIndexAt(stand.x,stand.z)).toBe(index);
 });
 it('keeps fixed tile coordinates distinct from card identity and rank',()=>{
  expect(worldGridCoordinate(0)).toBe('A1');expect(worldGridCoordinate(17)).toBe('R1');expect(worldGridCoordinate(18)).toBe('A2');expect(worldGridCoordinate(251)).toBe('R14');
  for(let row=0;row<WORLD_GRID_FIELD.rows;row++)for(let col=0;col<WORLD_GRID_FIELD.columns;col++){const point=worldGridPoint(col*104*.67,row*142*.67);expect(worldGridIndexAt(point.x,point.z)).toBe(row*WORLD_GRID_FIELD.columns+col);}
 });
 it('fits every vertex to uneven terrain at a fixed lift',()=>{
  const geometry=new THREE.PlaneGeometry(1,1,8,12),center=worldGridPoint(180,210),height=(x:number,z:number)=>Math.sin(x)*.2+z*.1;
  fitWorldGridCard(geometry,center,height);const p=geometry.attributes.position;
  expect(p.count).toBe(117);for(let i=0;i<p.count;i++)expect(p.getY(i)).toBeCloseTo(height(p.getX(i),p.getZ(i))+WORLD_GRID_CARD.lift,5);
  const p0=new THREE.Vector3().fromBufferAttribute(p,0),p8=new THREE.Vector3().fromBufferAttribute(p,8);expect(Math.hypot(p8.x-p0.x,p8.z-p0.z)).toBeCloseTo(2,6);geometry.dispose();
 });
 it('anchors a selected foundation at its original position after compacting the grid',()=>{
  const chosen=worldGridPoint(139.36,190.28),foundation=worldGridPoint(243.88,190.28),offset=chosen.clone().sub(foundation);
  expect(worldGridPoint(243.88,190.28,offset).distanceTo(chosen)).toBeLessThan(1e-10);
 });
 it('lands the world arc exactly and holds its phase when paused',()=>{
  const jump=createWorldGridJump({x:0,y:.2,z:0},{x:2,y:.5,z:-3},()=>true)!;const a=jump.update(.2),b=jump.update(0);expect(b).toEqual(a);const end=jump.update(10);expect(end).toMatchObject({x:2,y:.5,z:-3,done:true});
 });
 it('refuses a blocked arc and respects reduced motion without changing the landing',()=>{
  const from={x:0,y:0,z:0},to={x:2,y:.2,z:-2};expect(createWorldGridJump(from,to,()=>false)).toBeUndefined();expect(createWorldGridJump(from,to,()=>true,true)!.update(.01)).toMatchObject({...to,done:true});
 });
 it('covers the tree-ring floor with enlarged cards and seams below one percent of card width',()=>{
  const trees=Array.from({length:30},(_,i)=>{const r=14+Math.sin(i*7.3)*2,angle=i*2.399963;return {x:Math.cos(angle)*r,z:Math.sin(angle)*r};});
  const boundary=worldGridBoundary(trees),tiles=worldGridTiles(boundary),coverage=tiles.reduce((n,t)=>n+t.area,0)/gridPolygonArea(boundary);
  expect(tiles.length).toBeGreaterThan(100);expect(coverage).toBeGreaterThan(.985);expect(coverage).toBeLessThanOrEqual(1);expect(WORLD_GRID_CARD.gap/WORLD_GRID_CARD.width).toBeLessThan(.01);
 });
 it('clips tessellated perimeter cards to the tree boundary and samples their actual terrain',()=>{
  const boundary=worldGridBoundary([]),tile=worldGridTiles(boundary).find(t=>t.area<WORLD_GRID_CARD.width*WORLD_GRID_CARD.height*.8)!,height=(x:number,z:number)=>.015*x*x+.03*z;
  const geometry=worldGridTileGeometry(tile,boundary,height),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i);expect(p.getY(i)).toBeCloseTo(height(x,z)+WORLD_GRID_CARD.lift,5);
   for(let j=0;j<boundary.length;j++){const a=boundary[j],b=boundary[(j+1)%boundary.length];expect((b.x-a.x)*(z-a.y)-(b.y-a.y)*(x-a.x)).toBeGreaterThan(-.0001);}
  }geometry.dispose();
 });
});
