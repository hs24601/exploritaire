import * as THREE from 'three';
import {createMeadowPortalParticles} from './meadowPortalParticles';

/** Linear size, independent of the arcing position and accelerated spin. */
export function pickupFlightPose(start:THREE.Vector3,target:THREE.Vector3,progress:number,out:THREE.Vector3,reduced=false){
  const t=THREE.MathUtils.clamp(progress,0,1);
  out.copy(start).lerp(target,t);if(!reduced)out.y+=Math.sin(Math.PI*t)*1.65;
  return 1-t;
}

/** Reusable for a loose card or an entire pack. Reward callbacks fire once,
 * on contact, even if the player keeps moving or several pickups overlap. */
export class CastlePickupFlights{
  private flights=new Map<number,{object:THREE.Object3D;start:THREE.Vector3;angle:number;age:number}>();
  constructor(private readonly reduced:boolean){}
  has(id:number){return this.flights.has(id);}
  start(id:number,object:THREE.Object3D){if(this.has(id))return false;this.flights.set(id,{object,start:object.position.clone(),angle:object.rotation.y,age:0});return true;}
  update(dt:number,target:THREE.Vector3,arrived:(id:number)=>void){
    for(const [id,flight]of this.flights){
      flight.age+=dt;const t=Math.min(1,flight.age/(this.reduced?.18:.85));
      flight.object.scale.setScalar(pickupFlightPose(flight.start,target,t,flight.object.position,this.reduced));
      if(!this.reduced)flight.object.rotation.set(0,flight.angle+t*Math.PI*5,0);
      if(t>=1){flight.object.visible=false;this.flights.delete(id);arrived(id);}
    }
  }
  get diagnostics(){return [...this.flights].map(([id,f])=>({id,age:f.age,scale:f.object.scale.x,position:f.object.position.toArray()}));}
}

export function createCastlePickupEffects(scene:THREE.Scene,heroMaterial:THREE.MeshBasicMaterial,reduced:boolean,low:boolean){
  const shimmer={value:-1},still={value:reduced?1:0};let contacts=0;
  const previous=heroMaterial.onBeforeCompile,key=heroMaterial.customProgramCacheKey.bind(heroMaterial);
  heroMaterial.onBeforeCompile=(shader,renderer)=>{
    previous.call(heroMaterial,shader,renderer);Object.assign(shader.uniforms,{pickupShimmerAge:shimmer,pickupStill:still});
    shader.vertexShader='varying vec2 pickupUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npickupUv=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float pickupShimmerAge,pickupStill;varying vec2 pickupUv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      float pickupFade=max(0.,1.-pickupShimmerAge/1.1)*step(0.,pickupShimmerAge);
      float pickupDelta=pickupUv.x+pickupUv.y*.3-(pickupShimmerAge*1.65-.1);
      float pickupBand=exp(-90.*pickupDelta*pickupDelta);
      vec3 pickupFilm=.5+.5*cos(vec3(0.,2.1,4.2)+pickupUv.y*6.+pickupShimmerAge*4.);
      outgoingLight+=pickupFade*(vec3(.16,.12,.045)+pickupFilm*pickupBand*.75*(1.-pickupStill));
      #include <opaque_fragment>`);
  };
  heroMaterial.customProgramCacheKey=()=>key()+':pickup-shimmer-v1';heroMaterial.needsUpdate=true;
  const bursts=Array.from({length:3},()=>{
    const age={value:-1},points=createMeadowPortalParticles(age,{value:1},reduced?0:low?24:56);
    points.scale.setScalar(.65);points.userData.skipWaterReflection=true;scene.add(points);return {age,points};
  });
  let next=0;
  return {
    collect(hero:THREE.Vector3){contacts++;shimmer.value=0;const burst=bursts[next++%bursts.length];burst.age.value=0;burst.points.position.copy(hero);burst.points.visible=!reduced;},
    update(dt:number,hero:THREE.Vector3,visible:boolean){
      if(shimmer.value>=0){shimmer.value+=dt*(reduced?5:1);if(shimmer.value>1.1)shimmer.value=-1;}
      for(const burst of bursts)if(burst.age.value>=0){burst.age.value+=dt;burst.points.position.copy(hero);burst.points.visible=visible&&!reduced&&burst.age.value<1.7;if(burst.age.value>=1.7)burst.age.value=-1;}
    },
    setLow(){for(const burst of bursts)burst.points.geometry.setDrawRange(0,24);},
    get diagnostics(){return {contacts,shimmer:shimmer.value,bursts:bursts.filter(b=>b.points.visible).length,particleCount:bursts[0].points.geometry.attributes.position.count};},
  };
}
