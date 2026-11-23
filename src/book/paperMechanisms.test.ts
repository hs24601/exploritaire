import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {pageHinge,solveParallelFold,solveLinkedFlap} from './paperMechanisms';

describe('connected woodland paper pattern',()=>{
 it('keeps every panel and connecting strip rigid through forward and reverse opening',()=>{
  for(const k of [...Array.from({length:301},(_,i)=>i),...Array.from({length:301},(_,i)=>300-i)]){
   const theta=Math.max(.001,k/300*Math.PI),h=pageHinge(theta),s=solveParallelFold(h,.55,.55,.9,.9);
   expect(s.C.distanceTo(s.A)).toBeCloseTo(.9,8);expect(s.C.distanceTo(s.B)).toBeCloseTo(.9,8);
   const flap=solveLinkedFlap({origin:s.C,x:h.axis,y:s.panelA.y},h.origin,.65,.8,-1);
   const tip=flap.origin.clone().addScaledVector(flap.y,.65);
   expect(tip.distanceTo(h.origin)).toBeCloseTo(.8,8);
   expect(flap.x.dot(flap.y)).toBeCloseTo(0,8);
   expect([...s.C.toArray(),...tip.toArray()].every(Number.isFinite)).toBe(true);
  }
 });
 it('folds into the base plane, and rises continuously without changing branch',()=>{
  let previous:THREE.Vector3|undefined;
  for(let i=0;i<=300;i++){
   const h=pageHinge(Math.max(.001,i/300*Math.PI)),s=solveParallelFold(h,.55,.55,.9,.9);
   if(i===0)expect(Math.abs(s.C.y)).toBeLessThan(.002);
   if(i===300)expect(s.C.y).toBeGreaterThan(.7);
   if(previous)expect(s.C.distanceTo(previous)).toBeLessThan(.03);
   previous=s.C;
  }
 });
 it('rejects impossible lengths rather than producing a stretched panel',()=>{
  expect(()=>solveParallelFold(pageHinge(Math.PI),2,2,.5,.5)).toThrow('cannot reach');
  expect(()=>solveLinkedFlap({origin:new THREE.Vector3(),x:new THREE.Vector3(0,0,1),y:new THREE.Vector3(0,1,0)},new THREE.Vector3(20,0,0),1,1)).toThrow('cannot reach');
 });
});
