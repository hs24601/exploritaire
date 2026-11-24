import {it,expect} from 'vitest';
import * as THREE from 'three';
import {flurryPlay,uprightSticker} from './flurryPlay';
import {limitFlatPlaneFacing} from '../rendering/flatPlaneFacing';

it('stays upright after facing corrections, including a camera below the sticker',()=>{
 const object=new THREE.Group(),camera=new THREE.PerspectiveCamera();
 for(const y of [-10,0,10])for(let yaw=0;yaw<Math.PI*2;yaw+=.15){object.rotation.set(.1,yaw,.07);camera.position.set(0,y,10);limitFlatPlaneFacing(object,camera);uprightSticker(object);const up=new THREE.Vector3(0,1,0).applyQuaternion(object.quaternion);expect(up.y).toBeGreaterThanOrEqual(-1e-6);}
});
it('occasionally inverts, bounces, shakes, and returns to normal without reduced-motion flips',()=>{
 let inverted=false,bounce=false,shake=false,ends=0,last=false;
 for(let t=0;t<160;t+=.02){const p=flurryPlay(t);inverted ||=p.roll>3.1;bounce ||=p.bounce>.2;shake ||=Math.abs(p.shake)>.06;if(last&&!p.active)ends++;last=p.active;expect(flurryPlay(t,true).active).toBe(false);if(!p.active)expect(p.face).toBeUndefined();}
 expect([inverted,bounce,shake]).toEqual([true,true,true]);expect(ends).toBe(4);
});
