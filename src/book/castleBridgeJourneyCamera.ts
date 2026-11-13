import * as THREE from 'three';
import {BRIDGE_HALF_WIDTH} from './castleBridgePuzzle';

export function bridgeJourneyDestination(point:{x:number;z:number},sections:number){
  if(sections===0||Math.abs(point.x)>BRIDGE_HALF_WIDTH+1.5)return false;
  const edge=60-25*sections/3;
  return sections===3?point.z>=30&&point.z<=43.5:point.z>=edge+.4&&point.z<=edge+3.5;
}
/** Authored from Eric's camera telemetry. One bounded yaw sweep co-frames the
 * crossing and Hero, with aspect-aware distance and manual takeover. */
export function createBridgeJourneyCamera(reduced:boolean){
  const center=new THREE.Vector3(-.7920646298,4.8915543213,45.9331788698);
  const position=new THREE.Vector3(),target=new THREE.Vector3(),wanted=new THREE.Vector3();
  const initialPosition=new THREE.Vector3(),initialTarget=new THREE.Vector3();
  const goal=new THREE.Vector3(),startHero=new THREE.Vector3();
  let enabled=false,age=0,progress=0,fov=60,startFov=60,manual=false;
  const pose={position,target,fov:60,yaw:.97738288595,pitch:.55036037148,distance:40.68849905};
  return {
    start(hero:THREE.Vector3,destination:{x:number;y?:number;z:number},camera:THREE.PerspectiveCamera){
      position.copy(camera.position);camera.getWorldDirection(target);target.multiplyScalar(Math.max(4,camera.position.distanceTo(center))).add(position);
      initialPosition.copy(position);initialTarget.copy(target);startHero.copy(hero);goal.set(destination.x,destination.y??hero.y,destination.z);
      enabled=!reduced;manual=false;age=progress=0;fov=startFov=camera.fov;
    },
    update(dt:number,input:{hero:THREE.Vector3;destination?:{x:number;z:number};aspect:number}){
      if(!enabled)return;age+=dt;
      const total=Math.max(1,startHero.distanceTo(goal)),remaining=Math.hypot(goal.x-input.hero.x,goal.z-input.hero.z);
      progress=Math.max(progress,THREE.MathUtils.clamp(1-remaining/total,0,1));
      const sweep=.7*progress+.3*THREE.MathUtils.smoothstep(age,0,4);
      const yaw=.97738288595+THREE.MathUtils.lerp(-.13,.15,sweep);
      const fit=Math.max(1,Math.min(1.6,Math.sqrt(2.7921225383/input.aspect)));
      wanted.set(center.x+Math.sin(yaw)*25.411*fit,center.y+21.544323612*fit,center.z+Math.cos(yaw)*25.411*fit);
      const blend=THREE.MathUtils.smoothstep(age,0,2.5);
      position.copy(initialPosition).lerp(wanted,blend);target.copy(initialTarget).lerp(center,blend);
      fov=THREE.MathUtils.lerp(startFov,60,blend);pose.fov=fov;pose.yaw=yaw;pose.distance=position.distanceTo(input.hero);
      return pose;
    },
    release(){enabled=false;manual=true;},reset(){enabled=false;manual=false;},get active(){return enabled;},
    get diagnostics(){return {kind:'bridge',active:enabled,manual,phase:progress>.98?'hold':'bridge-pan',progress,age,position:position.toArray(),target:target.toArray(),fov,yaw:pose.yaw,range:pose.distance};},
  };
}
