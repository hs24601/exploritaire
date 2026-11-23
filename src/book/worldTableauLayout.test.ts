import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createPlayableSandboxScenario,returnPlayerTurn,withdrawPlayer} from '../proto/rules/battle';
import {worldTableauColumns,sixColumnWoodsBattle,midfieldTableauLayout,foundationPlaneBasis} from './worldTableauLayout';
import {fitFoundationFloor,foundationWorldPose,limitFoundationSkew} from './worldFoundationLayout';
describe('six midfield world tableaus',()=>{
 it('previews six populated columns without creating an encounter',()=>{
  const columns=worldTableauColumns();expect(columns).toHaveLength(6);expect(columns.every(col=>col.length===4)).toBe(true);
 });
 it('preserves every card when adapting the woods encounter to six columns',()=>{
  const original=createPlayableSandboxScenario('001'),adapted=sixColumnWoodsBattle(original);
  const ids=(s:typeof original)=>[...s.columns.flat(),...s.stock].map(card=>card.id).sort();
  expect(adapted.columns).toHaveLength(6);expect(adapted.rules.columns).toBe(6);expect(ids(adapted)).toEqual(ids(original));
  expect(original.columns).toHaveLength(7);expect(sixColumnWoodsBattle(adapted)).toBe(adapted);
 });
 it('keeps exactly three columns on either side of an open central corridor',()=>{
  const right=new THREE.Vector3(1,0,0),near=new THREE.Vector3(0,0,0),far=new THREE.Vector3(0,0,-8);
  const slots=midfieldTableauLayout(near,far,right);expect(slots.map(s=>s.side)).toEqual(['left','left','left','right','right','right']);
  expect(slots.every(s=>Math.abs(s.base.x)>=1.75)).toBe(true);expect(slots.every(s=>s.base.z<0&&s.base.z> -8)).toBe(true);
  const reversed=midfieldTableauLayout(far,near,right.clone().negate());expect(reversed[0].base.x).toBeGreaterThan(0);
 });
 it('keeps six columns after a Withdraw redeal rather than silently restoring seven',()=>{
  const state=sixColumnWoodsBattle(createPlayableSandboxScenario('001'));
  const redealt=returnPlayerTurn(withdrawPlayer(state));
  expect(redealt.columns).toHaveLength(6);expect(redealt.stock).toHaveLength(132);
  expect(returnPlayerTurn(withdrawPlayer(createPlayableSandboxScenario('001'))).columns).toHaveLength(7);
 });
 it('extracts the exact readable foundation plane for every tableau card',()=>{
  const camera=new THREE.PerspectiveCamera();camera.position.set(-2,1.6,4);
  const pose=foundationWorldPose(camera,new THREE.Vector3(),true),geometry=new THREE.PlaneGeometry(1,1,12,8);
  fitFoundationFloor(geometry,pose,()=>0);limitFoundationSkew(geometry,pose,camera,()=>0);
  const basis=foundationPlaneBasis(geometry),transformed=new THREE.Vector3(0,0,1).applyQuaternion(basis.quaternion);
  expect(transformed.dot(basis.normal)).toBeCloseTo(1,6);expect(basis.right.dot(basis.up)).toBeCloseTo(0,6);
  expect(basis.up.y).toBeGreaterThan(0);geometry.dispose();
 });
});
