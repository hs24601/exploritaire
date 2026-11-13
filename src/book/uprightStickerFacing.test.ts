import {it,expect} from 'vitest';
import * as THREE from 'three';
import {uprightStickerYaw} from './uprightStickerFacing';
it('keeps the plane at ninety degrees to ground and preserves front/back during spins',()=>{
 for(let i=0;i<80;i++){
  const authored=i*.13,view=.7,yaw=uprightStickerYaw(authored,view),normal=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
  expect(normal.y).toBe(0);expect(Math.abs(Math.cos(yaw-view))).toBeGreaterThanOrEqual(Math.cos(65*Math.PI/180)-1e-6);
  expect(Math.sign(Math.cos(yaw-view))).toBe(Math.sign(Math.cos(authored-view)));
 }
});
