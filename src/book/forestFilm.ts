import * as THREE from 'three';
import type {BookCameraStep} from './bookCamera';
import scenes from '../data/bookScenes.json';
import {validBookDocument} from './sceneDocument';
import {forestPaintBehind} from './forestPaint';

export const FOREST_FILM_MS=20000;
const smooth=(a:number,b:number,t:number)=>THREE.MathUtils.smoothstep(t,a,b);
/** A light's path and flash are shared by the visible mote and its real lamp. */
export function forestMote(i:number,t:number,treelineAge?:number){
 const phase=i*2.39996323,hero=i<3;
 const angle=phase+t*(hero?.12+i*.025:.05+(i%5)*.011)*(i%2?-1:1)+.24*Math.sin(t*.073+phase);
 const radius=(hero?6.8:3.2+(i%11)*.43)*(.72+.24*Math.sin(t*.11+phase*.63));
 const roaming={x:Math.cos(angle)*radius+.45*Math.sin(t*.13+phase),y:.5+(i%7)*.21+Math.sin(t*.43+phase)*.3,z:-.9+Math.sin(angle)*radius*.62+.3*Math.sin(t*.083+phase),
  flash:(hero?.65:.25)+.65*Math.pow(.5+.5*Math.sin(t*1.4-phase*.38),4)};
 if(treelineAge===undefined)return roaming;
 // A rounded rectangular path follows the paper tree wall, never the clearing.
 const c=Math.cos(angle),s=Math.sin(angle),edge=Math.pow(Math.pow(Math.abs(c),6)+Math.pow(Math.abs(s),6),1/6);
 const ringX=c/edge*(6.05+.22*Math.sin(t*.17+phase)),ringZ=-.65+s/edge*(3.75+.12*Math.sin(t*.13+phase));
 // Only one third leave the grove; their continuous path grows inward after arrival.
 const release=i%3===0?smooth((i%9)*.55,12+(i%9)*.55,treelineAge):0;
 return {...roaming,x:THREE.MathUtils.lerp(ringX,2.6*Math.sin(angle*.81+phase*.17),release),z:THREE.MathUtils.lerp(ringZ,-.3+1.8*Math.sin(angle*.67+phase*.31),release)};
}
export function forestNight(t:number){return smooth(5,9,t)*(1-smooth(16.2,19.2,t));}

/** Fine luminous bodies, wider lens haloes, and three matching engine lights.
 * No full-scene blur or screen-space lighting overlay. Hidden at either shut end. */
export function createForestLights(world:THREE.Scene){
 const root=new THREE.Group();root.name='forest-dancing-lights';world.add(root);root.visible=false;
 const count=84,positions=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count);
 const palette=[new THREE.Color('#ffe39b'),new THREE.Color('#8cf4e7'),new THREE.Color('#d6f6b2')];
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('moteSize',new THREE.BufferAttribute(sizes,1));
 for(let i=0;i<count;i++)sizes[i]=i<3?.2:.08+(i%4)*.025;
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,
  uniforms:{pixelHeight:{value:720},visibility:{value:0}},
  vertexShader:`attribute float moteSize;uniform float pixelHeight;varying vec3 tint;void main(){tint=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(moteSize*pixelHeight*projectionMatrix[1][1]/max(.1,-p.z),2.,110.);}`,
  fragmentShader:`uniform float visibility;varying vec3 tint;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float halo=exp(-r*r*7.)*.24;float core=exp(-r*r*150.);gl_FragColor=vec4(tint*(halo+core*2.2),visibility*(1.-smoothstep(.65,1.,r)));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});
 const motes=new THREE.Points(geometry,material);motes.frustumCulled=false;root.add(motes);
 const lamps=palette.map(c=>{const light=new THREE.PointLight(c,0,3.2,2);root.add(light);return light;});
 return {root,update(t:number,open:number,enabled:boolean,pixelHeight:number,paint=1,motionTime=t,activation?:(x:number,y:number,z:number)=>number,treelineAge?:number){
  const night=forestNight(t),gain=smooth(.2,.9,open)*(.15+.85*night);root.visible=enabled&&gain>0;material.uniforms.visibility.value=gain;material.uniforms.pixelHeight.value=pixelHeight;
  let visible=0;for(let i=0;i<count;i++){const p=forestMote(i,motionTime,treelineAge),color=palette[i%3],painted=forestPaintBehind(paint,p.x,p.y,p.z),flash=p.flash*painted*(activation?.(p.x,p.y,p.z)??1);if(flash>0)visible++;positions.set([p.x,p.y,p.z],i*3);colors.set([color.r*flash,color.g*flash,color.b*flash],i*3);if(i<3){lamps[i].position.set(p.x,p.y,p.z);lamps[i].intensity=enabled?gain*flash*2.8:0;}}
  geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;
  return {night,visible:enabled?visible:0,lamps:enabled?lamps.reduce((n,l)=>n+l.intensity,0):0};
 },dispose(){root.removeFromParent();geometry.dispose();material.dispose();}};
}

/** The first and last shots are the same closed book. All times total 20 s.
 * Stages use existing editable V-fold controls, including a foreground actuation
 * during the close shot, rather than replacing paper with a full-screen forest. */
export function forestFilmShots():BookCameraStep[]{
 const document:unknown=scenes;
 if(!validBookDocument(document))throw Error('Invalid forest shot document');
 return structuredClone(document.chapters.flatMap(c=>c.scenes).find(s=>s.id==='scene-page-2')!.shots);
}
