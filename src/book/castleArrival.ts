import {SHOULDER,type FlightKey,type shoulderPose} from './castleLayout';
import * as THREE from 'three';

export const BRIDGE_HERO_START={x:0,z:75};

/** Natural-world follow mode looks along the orbit's yaw/pitch, rather than
 * the castle's Hero framing cone. Arrival and follow must share this aim. */
export function orbitLookTarget(position:readonly number[],yaw:number,pitch:number):[number,number,number]{
  return [position[0]-Math.sin(yaw)*Math.cos(pitch),position[1]-Math.sin(pitch),position[2]-Math.cos(yaw)*Math.cos(pitch)];
}

export function groundedOrbitPose(rest:ReturnType<typeof shoulderPose>,yaw:number,pitch:number,height:(x:number,z:number)=>number):ReturnType<typeof shoulderPose>{
  const position:[number,number,number]=[...rest.position];
  position[1]=Math.max(position[1],height(position[0],position[2])+.45);
  return {position,target:orbitLookTarget(position,yaw,pitch)};
}

/** One uninterrupted approach to the new moat composition. With only two
 * positional keys the sampler follows their segment, never an old landing. */
export function directGroundsArrival(rest:ReturnType<typeof shoulderPose>,hero?:{x:number;y:number;z:number},aspect=16/9,options:{constrainAim?:boolean}={}):readonly FlightKey[]{
  let target=rest.target;
  if(hero&&options.constrainAim!==false){
    // Apply the same Hero framing cone as follow mode, so the last flight aim
    // also matches the first follow aim, not only its camera position.
    const position=new THREE.Vector3(...rest.position),toHero=new THREE.Vector3(hero.x,hero.y+.55,hero.z).sub(position),aim=new THREE.Vector3(...target).sub(position).normalize();
    const halfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(SHOULDER.fov/2))*Math.min(1,aspect));
    const limit=Math.max(0,halfFov-Math.asin(Math.min(1,.8/toHero.length())));toHero.normalize();
    const angle=toHero.angleTo(aim);
    if(angle>limit){const turn=new THREE.Quaternion().setFromUnitVectors(toHero,aim),limited=new THREE.Quaternion().slerp(turn,limit/angle);target=position.clone().add(toHero.applyQuaternion(limited)).toArray();}
  }
  return [{t:0,position:[96,55,180],target,fov:50},{t:8,position:rest.position,target,fov:SHOULDER.fov}];
}
