import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {TurnPopups} from './turnPopups';

describe('live mechanisms during cached page motion',()=>{
 it('keeps mechanisms visible with their spread hidden, carries the left mount and restores both exactly',()=>{
  const world=new THREE.Group(),spread=new THREE.Group();world.add(spread);
  const left=new THREE.Group(),right=new THREE.Group();left.position.set(-3,.145,1);right.position.set(3,.145,1);left.rotation.y=.4;spread.add(left,right);
  const rig=new TurnPopups(world);rig.begin([left,right]);spread.visible=false;rig.update(.5,true);
  expect(left.parent!.parent).toBe(world);expect(left.parent!.visible).toBe(true);
  expect(left.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(3.145);
  expect(right.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([3,.145,1]);
  rig.update(1,true);expect(left.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(-3);
  rig.restore();expect(rig.count).toBe(0);expect(left.parent).toBe(spread);expect(left.position.toArray()).toEqual([-3,.145,1]);expect(left.rotation.y).toBeCloseTo(.4);expect(world.children).toEqual([spread]);
 });
 it('keeps fully closed mechanisms hidden and preserves authored hidden objects',()=>{
  const world=new THREE.Group(),spread=new THREE.Group(),root=new THREE.Group(),hidden=new THREE.Group();world.add(spread);spread.add(root,hidden);hidden.visible=false;
  const rig=new TurnPopups(world);rig.begin([root,hidden]);rig.update(0,true);expect(root.parent!.visible).toBe(false);expect(hidden.parent).toBe(spread);rig.restore();expect(hidden.visible).toBe(false);
 });
});
