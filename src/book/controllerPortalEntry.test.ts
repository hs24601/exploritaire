import {it,expect} from 'vitest';
import * as THREE from 'three';
import {MeadowPortalEnd} from './castleMeadowPortal';
import {controllerPortalEntry} from './controllerPortalEntry';
import {createWorldPortalGuard} from './worldPortalGuard';
import {CastlePlatformMotion,type PlatformInput} from './castlePlatformMotion';

const neutral:PlatformInput={x:0,z:0,run:false,crouch:false,jumpPressed:false,jumpHeld:false,divePressed:false};
// Real doorway geometry methods without constructing the unrelated DOM title.
const card=()=>Object.assign(Object.create(MeadowPortalEnd.prototype),{door:{x:0,y:0,z:0,yaw:0},normal:new THREE.Vector3(0,0,1),cardTitle:'Painted Valley'}) as MeadowPortalEnd;
it.each([false,true])('manually %s crosses the selected card from both sides with collision enabled',jump=>{
 for(const side of [-1,1]){
  const door=card(),guard=createWorldPortalGuard();
  const surface={height:()=>0,wall:()=>false,move:(x:number,z:number,dx:number,dz:number):{x:number;z:number}=>guard.blocked([door],x+dx,z+dz,.45,hero.y)?{x,z}:{x:x+dx,z:z+dz}};
  const hero=new CastlePlatformMotion(0,side*4,side>0?Math.PI:0,surface);let crossed=false,airborne=false;
  for(let frame=0;frame<600;frame++){
   guard.arm();const direction={x:0,z:-side};const entry=controllerPortalEntry([door],hero,direction);if(entry)guard.arm(entry);
   hero.update(1/120,{...neutral,...direction,jumpPressed:jump&&Math.abs(hero.z)<3&&!airborne,jumpHeld:jump});
   airborne||=!hero.grounded;
   if(door.canCross(hero,guard.permits(door))){crossed=true;break;}
  }
  expect(crossed).toBe(true);expect(airborne).toBe(jump);
 }
});
it('requires movement into the actual aperture, not proximity, sideways input or a separate floor',()=>{
 const a=card();
 expect(controllerPortalEntry([a],{x:0,y:0,z:2},{x:0,z:-1})).toBe(a);
 for(const [hero,input] of [
  [{x:0,y:0,z:2},{x:0,z:0}], [{x:0,y:0,z:2},{x:0,z:1}],
  [{x:0,y:0,z:2},{x:1,z:0}], [{x:3,y:0,z:2},{x:0,z:-1}],
  [{x:0,y:8,z:2},{x:0,z:-1}], [{x:0,y:-3,z:2},{x:0,z:-1}],
 ] as const)expect(controllerPortalEntry([a],hero,input)).toBeUndefined();
 expect(a.canCross({x:0,y:0,z:.3,vx:0,vz:-1},false)).toBe(false);
 expect(a.canCross({x:0,y:4,z:.3,vx:0,vz:-1},true)).toBe(true);
});
