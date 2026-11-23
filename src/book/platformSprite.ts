import * as THREE from 'three';
import type {HeroMotion} from './platformerLevel';
import type {HeroIdlePose} from './heroIdle';
type Frame={index:number;rect:{x:number;y:number;width:number;height:number};pivot:{x:number;y:number}};
type Clip={id:string;image:string;fps:number;loop:boolean;frames:Frame[]};
export async function createPlatformHero(report:(done:number,total:number)=>void){
 const base=`${import.meta.env.BASE_URL}assets/runtime/characters/hero/platforming/`,root=base+'suite-v1/',idleRoot=base+'idle-v2/';
 const responses=await Promise.all([fetch(root+'manifest.json'),fetch(idleRoot+'manifest.json')]);if(responses.some(r=>!r.ok))throw Error('Hero sprite manifest could not load');
 const [legacy,idles]=await Promise.all(responses.map(r=>r.json())) as [{clips:Clip[]},{clips:Clip[]}];
 // Legacy idle/sit sheets contain baked winks and are deliberately excluded.
 const legacyIds=['run','crawl','jump','hurdle','fall-land','ledge-climb','celebrate','sit-stand'];
 const sources=[...legacy.clips.filter(c=>legacyIds.includes(c.id)).map(c=>({...c,url:root+c.image})),...idles.clips.map(c=>({...c,url:idleRoot+c.image}))];
 const textures=new Map<string,THREE.Texture>(),masks=new Map<string,Uint8ClampedArray>(),clips=new Map(sources.map(c=>[c.id,c]));let done=0;
 await Promise.all(sources.map(async clip=>{
  const t=await new THREE.TextureLoader().loadAsync(clip.url);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;const image=t.image as HTMLImageElement;await image.decode();textures.set(clip.id,t);
  const mask=document.createElement('canvas');mask.width=512;mask.height=64;const ctx=mask.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0,512,64);masks.set(clip.id,ctx.getImageData(0,0,512,64).data);
  report(++done,sources.length);
 }));
 const material=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false,alphaTest:.015});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(140,140),material);mesh.renderOrder=10;
 const butterflyMaterial=new THREE.MeshBasicMaterial({map:textures.get('butterfly'),transparent:true,depthWrite:false,toneMapped:false,alphaTest:.015});
 const butterfly=new THREE.Mesh(new THREE.PlaneGeometry(42,42),butterflyMaterial);butterfly.renderOrder=11;butterfly.visible=false;
 let previous='',clock=0,lastFrame=-1,currentClip='breath',currentFrame=0;
 return {mesh,butterfly,textures,hitTest(ray:THREE.Raycaster){
  mesh.updateMatrixWorld(true);const hit=ray.intersectObject(mesh,false)[0];if(!hit?.uv)return false;
  const x=currentFrame*64+Math.max(0,Math.min(63,Math.floor(hit.uv.x*64))),y=Math.max(0,Math.min(63,Math.floor((1-hit.uv.y)*64)));
  return (masks.get(currentClip)?.[(y*512+x)*4+3]??0)>32;
 },update(x:number,y:number,motion:HeroMotion,facing:number,dt:number,progress:number,_finished:boolean,idle?:HeroIdlePose){
  const id=idle?.clip??(motion==='run'?'run':motion==='crawl'?'crawl':motion==='jump'?'jump':motion==='hurdle'?'hurdle':motion==='fall'||motion==='land'?'fall-land':motion==='climb'?'ledge-climb':motion==='celebrate'?'celebrate':'breath');
  if(id+motion!==previous){clock=0;lastFrame=-1;previous=id+motion;}clock+=dt;
  const clip=clips.get(id)!,texture=textures.get(id)!;let frame=0;
  if(idle)frame=idle.frame;
  else if(motion==='jump'||motion==='hurdle')frame=Math.min(7,Math.floor(progress*8));
  else if(motion==='fall')frame=Math.min(3,Math.floor(progress*4));
  else if(motion==='land')frame=4+Math.min(3,Math.floor(clock/.22*4));
  else if(motion==='climb')frame=Math.min(7,Math.floor(progress*8));
  else if(id==='breath')frame=[0,1,2,3,2,1][Math.floor(clock/3.2*6)%6];
  else frame=clip.loop?Math.floor(clock*clip.fps)%8:Math.min(7,Math.floor(clock*clip.fps));
  const f=clip.frames[frame];if(material.map!==texture||frame!==lastFrame){texture.repeat.set(1/8,1);texture.offset.set(frame/8,0);texture.updateMatrix();material.map=texture;material.needsUpdate=lastFrame===-1;lastFrame=frame;}
  const direction=idle?.facing??facing,airborne=!idle&&(motion==='jump'||motion==='hurdle'||motion==='fall'||motion==='land'),grip=!idle&&motion==='climb',anchorY=y-(grip?65:airborne?42:0);
  mesh.position.set(x+(idle?.offsetX??0)+(0.5-f.pivot.x)*140*direction,1100-anchorY+(f.pivot.y-.5)*140,26);mesh.scale.x=direction;
  currentClip=id;currentFrame=frame;mesh.userData.clip=id;mesh.userData.frame=frame;mesh.userData.idleAction=idle?.action??'';
  butterfly.visible=!!idle?.butterfly;if(idle?.butterfly){const b=idle.butterfly,t=textures.get('butterfly')!;t.repeat.set(1/8,1);t.offset.set(b.frame/8,0);t.updateMatrix();butterfly.position.set(b.x,1100-b.y,28);}
 },dispose(){mesh.geometry.dispose();material.dispose();butterfly.geometry.dispose();butterflyMaterial.dispose();textures.forEach(t=>t.dispose());}};
}
