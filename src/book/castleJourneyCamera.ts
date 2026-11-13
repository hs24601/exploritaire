import * as THREE from 'three';

export type JourneyPoint={x:number;y?:number;z:number};
export type JourneyLandmark={id:string;point:THREE.Vector3;radius:number;halfHeight:number;priority?:number};
type Input={hero:THREE.Vector3;velocity:THREE.Vector3;grounded:boolean;destination?:JourneyPoint;route:readonly JourneyPoint[];aspect:number};
type Visibility=(from:THREE.Vector3,to:THREE.Vector3,radius?:number)=>boolean;
const turn=(from:number,to:number)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
const clamp=THREE.MathUtils.clamp;

/** Continuous route-aware shots, never a repeating orbit or a timed cut sequence.
 * Geometry clearance remains owned by the scene's existing final camera resolver. */
export function createJourneyCamera(reduced:boolean,visible:Visibility,style:'close'|'cinematic'='close'){
  const position=new THREE.Vector3(),target=new THREE.Vector3(),wantedPosition=new THREE.Vector3(),wantedTarget=new THREE.Vector3();
  const goal=new THREE.Vector3(),heroFocus=new THREE.Vector3(),direction=new THREE.Vector3(),routeDirection=new THREE.Vector3();
  const scratch=new THREE.Vector3(),rayHero=new THREE.Vector3(),rayContext=new THREE.Vector3(),candidate=new THREE.Vector3();
  const initialOffset=new THREE.Vector3(),initialAimOffset=new THREE.Vector3();
  const framingCamera=new THREE.PerspectiveCamera(68,1,.08,9000);
  const points=Array.from({length:6},()=>new THREE.Vector3());
  let enabled=false,manual=false,age=0,arrived=0,poll=0,held=0;
  let yaw=0,initialYaw=0,side=1,pitch=.18,range=8.5,fov=60,initialRange=8.5,initialPitch=.18;
  let landmark:JourneyLandmark|undefined,landmarks:readonly JourneyLandmark[]=[],phase='idle',blockedContext=false,shotOffset=0;
  const pose={position,target,fov:60,yaw:0,pitch:.18,distance:8.5};

  function compose(from:THREE.Vector3,hero:THREE.Vector3,context?:JourneyLandmark){
    rayHero.subVectors(hero,from).normalize();
    if(context){
      // Fit the subject's silhouette and the landmark's vertical extent as a
      // group, rather than simply pointing halfway between their world centers.
      rayContext.set(0,0,0);
      for(const sign of [-1,1]){
        scratch.copy(context.point);scratch.y+=sign*context.halfHeight;
        rayContext.add(scratch.sub(from).normalize());
      }
      rayContext.normalize();
      direction.copy(rayHero).multiplyScalar(.53).addScaledVector(rayContext,.47).normalize();
    }else direction.copy(rayHero);
    return wantedTarget.copy(from).addScaledVector(direction,Math.max(4,from.distanceTo(hero)));
  }
  function fits(from:THREE.Vector3,hero:THREE.Vector3,context:JourneyLandmark,aspect:number){
    compose(from,hero,context);
    framingCamera.position.copy(from);framingCamera.aspect=aspect;framingCamera.fov=68;
    framingCamera.updateProjectionMatrix();framingCamera.lookAt(wantedTarget);framingCamera.updateMatrixWorld();
    points[0].copy(hero);points[0].y+=.65;points[1].copy(hero);points[1].y-=.65;
    points[2].copy(context.point);points[2].y+=context.halfHeight;
    points[3].copy(context.point);points[3].y-=context.halfHeight;
    const right=scratch.set(1,0,0).applyQuaternion(framingCamera.quaternion).multiplyScalar(context.radius*.6);
    points[4].copy(context.point).add(right);points[5].copy(context.point).sub(right);
    return points.every(p=>{p.project(framingCamera);return Math.abs(p.x)<.9&&Math.abs(p.y)<.9&&p.z> -1&&p.z<1;});
  }
  function pickContext(input:Input,desiredYaw:number,desiredRange:number){
    const options=landmarks.map(item=>{
      scratch.subVectors(item.point,input.hero);const d=scratch.length();
      const forward=scratch.x*routeDirection.x+scratch.z*routeDirection.z;
      return {item,d,score:(item.priority??1)*(1+forward/Math.max(1,d))/(1+d/70)};
    }).filter(o=>o.d>10&&o.d<170&&o.score>.1).sort((a,b)=>b.score-a.score);
    let selected:JourneyLandmark|undefined,bestYaw=desiredYaw;
    for(const {item}of options){
      for(const offset of [0,side*.25,-side*.25]){
        const angle=desiredYaw+offset;
        candidate.set(input.hero.x+Math.sin(angle)*desiredRange*Math.cos(.17),input.hero.y+1.35+Math.sin(.17)*desiredRange,input.hero.z+Math.cos(angle)*desiredRange*Math.cos(.17));
        if(!visible(candidate,heroFocus)||!visible(candidate,item.point,item.radius))continue;
        if(!fits(candidate,heroFocus,item,input.aspect))continue;
        selected=item;bestYaw=angle;break;
      }
      if(selected)break;
    }
    return {selected,yaw:bestYaw};
  }
  return {
    start(hero:THREE.Vector3,destination:JourneyPoint,camera:THREE.PerspectiveCamera,context:readonly JourneyLandmark[]){
      // Re-targeting starts from the rendered shot; no jump back to a preset.
      position.copy(camera.position);camera.getWorldDirection(direction);
      target.copy(position).addScaledVector(direction,Math.max(4,position.distanceTo(hero)));
      initialOffset.subVectors(position,hero);initialAimOffset.subVectors(target,hero);
      goal.set(destination.x,destination.y??hero.y,destination.z);landmarks=context;
      const dx=position.x-hero.x,dz=position.z-hero.z;
      yaw=initialYaw=Math.atan2(dx,dz);initialRange=clamp(Math.hypot(dx,position.y-hero.y-1.35,dz),2.6,165);
      range=initialRange;pitch=initialPitch=clamp(Math.atan2(position.y-hero.y-1.35,Math.hypot(dx,dz)),-.35,1.55);
      const heading=Math.atan2(hero.x-goal.x,hero.z-goal.z);side=Math.sin(yaw-heading)<0?-1:1;
      fov=camera.fov;enabled=true;manual=false;age=arrived=poll=held=shotOffset=0;landmark=undefined;phase='establish';
    },
    release(){enabled=false;manual=true;landmark=undefined;phase='manual';},
    reset(){enabled=false;manual=false;landmark=undefined;phase='idle';},
    update(dt:number,input:Input){
      if(!enabled)return;
      age+=dt;poll-=dt;held+=dt;
      heroFocus.copy(input.hero);heroFocus.y+=.65;
      if(input.destination){goal.set(input.destination.x,input.destination.y??input.hero.y,input.destination.z);arrived=0;}
      else arrived+=dt;
      if(style==='close'){
        // Keep the player's chosen boom and lens. Long routes and distant
        // scenery must not turn an ordinary walk into an establishing shot.
        phase=input.destination?'follow':arrived<1.6?'arrival':'settled';
        wantedPosition.copy(input.hero).add(initialOffset);wantedTarget.copy(heroFocus);
        if(reduced)wantedTarget.copy(input.hero).add(initialAimOffset);
        const blend=reduced?1:1-Math.exp(-dt*10);
        position.lerp(wantedPosition,blend);target.lerp(wantedTarget,blend);
        pose.fov=fov;pose.yaw=yaw;pose.pitch=pitch;pose.distance=range;
        return pose;
      }
      const remaining=Math.hypot(goal.x-input.hero.x,goal.z-input.hero.z),speed=Math.hypot(input.velocity.x,input.velocity.z);
      phase=!input.destination?(arrived<1.6?'arrival':'settled'):!input.grounded?'jump':remaining<4?'arrival':age<3&&remaining>14?'establish':'travel';
      const next=input.route.find(p=>Math.hypot(p.x-input.hero.x,p.z-input.hero.z)>1.2)??input.destination;
      routeDirection.set(next?next.x-input.hero.x:input.velocity.x,0,next?next.z-input.hero.z:input.velocity.z);
      if(routeDirection.lengthSq()<.01)routeDirection.set(-Math.sin(yaw),0,-Math.cos(yaw));else routeDirection.normalize();
      const travelYaw=Math.atan2(-routeDirection.x,-routeDirection.z)+side*.34;
      let desiredYaw=travelYaw+shotOffset;
      let desiredRange=phase==='establish'?18:clamp(8+speed*.55+remaining*.045,8,16);
      if(phase==='arrival'||phase==='settled')desiredRange=8;
      if(phase==='jump')desiredRange=Math.max(11,desiredRange);
      if(!input.destination)desiredYaw=yaw;
      if(poll<=0&&!reduced&&input.destination){
        poll=.45;
        const stillVisible=landmark&&visible(position,landmark.point,landmark.radius);
        if(!landmark||held>4.5||!stillVisible){
          const selection=pickContext(input,travelYaw,Math.max(16,desiredRange));
          if(selection.selected?.id!==landmark?.id)held=0;
          landmark=selection.selected;shotOffset=selection.yaw-travelYaw;desiredYaw=selection.yaw;
        }
        blockedContext=!!landmark&&!visible(position,landmark.point,landmark.radius);
      }
      if(landmark&&input.destination)desiredRange=Math.max(16,desiredRange);
      if(reduced){desiredYaw=initialYaw;desiredRange=initialRange;landmark=undefined;}
      // Preserve travel direction across corners without fast reversals or idle motion.
      yaw+=clamp(turn(yaw,desiredYaw),-dt*.42,dt*.42);
      range=THREE.MathUtils.lerp(range,desiredRange,1-Math.exp(-dt*.8));
      pitch=THREE.MathUtils.lerp(pitch,reduced?initialPitch:phase==='jump'?.24:landmark?.17:.20,1-Math.exp(-dt*.9));
      wantedPosition.set(input.hero.x+Math.sin(yaw)*Math.cos(pitch)*range,input.hero.y+1.35+Math.sin(pitch)*range,input.hero.z+Math.cos(yaw)*Math.cos(pitch)*range);
      // At each slow decision tick, favor the established side when it is clear;
      // final lens/line-of-sight correction is still performed every frame.
      compose(wantedPosition,heroFocus,landmark&&input.destination&&!blockedContext?landmark:undefined);
      if(!landmark&&input.destination&&!reduced){
        scratch.copy(routeDirection).multiplyScalar(Math.min(2.2,remaining*.25));wantedTarget.add(scratch);
      }
      if(reduced){wantedPosition.copy(input.hero).add(initialOffset);wantedTarget.copy(input.hero).add(initialAimOffset);}
      const blend=reduced?1:1-Math.exp(-dt*(input.grounded?3:2.2));
      position.lerp(wantedPosition,blend);target.lerp(wantedTarget,blend);
      if(!reduced)fov=THREE.MathUtils.lerp(fov,landmark&&input.destination?68:phase==='establish'?64:60,1-Math.exp(-dt*1.1));
      pose.fov=fov;pose.yaw=yaw;pose.pitch=pitch;pose.distance=range;
      return pose;
    },
    get active(){return enabled;},
    get diagnostics(){return {active:enabled,manual,style,phase,landmark:landmark?.id,position:position.toArray(),target:target.toArray(),fov,range,yaw};},
  };
}
