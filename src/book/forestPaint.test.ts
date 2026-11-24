import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {forestPaintProgress,forestPaintOrder,forestPaintFront,forestPaintAmount,forestPaintBehind} from './forestPaint';
import {createForestLights,forestFilmShots,forestMote} from './forestFilm';
import {sampleBookCamera} from './bookCamera';
import {createBookPaint} from './pagePaint';

describe('sparkle-led forest painting',()=>{
 it('holds the whole opening in sketch, then fills the forest slowly',()=>{
  for(const t of [0,2,4,8.3])expect(forestPaintProgress(t)).toBe(0);
  expect(forestPaintProgress(12.65)).toBeCloseTo(.5);expect(forestPaintProgress(17)).toBe(1);
  for(let x=-8;x<=8;x+=2)for(let z=-5.8;z<3.8;z+=1.2)for(const y of [.15,1.5,3]){
   expect(forestPaintAmount(0,x,y,z)).toBe(0);expect(forestPaintAmount(1,x,y,z)).toBe(1);
   let previous=0;for(let p=0;p<=1;p+=.025){const amount=forestPaintAmount(p,x,y,z);expect(amount).toBeGreaterThanOrEqual(previous);previous=amount;}
  }
 });
 it('uses the same curved edge for pigment and sparkles, with no atmospheric light in unpainted areas',()=>{
  for(const p of [.15,.3,.5,.75,.9])for(const x of [-7,-3,0,3,7])for(const y of [.2,1.5,2.8]){
   const z=forestPaintFront(p,x,y);expect(forestPaintOrder(x,y,z)).toBeCloseTo(p);
   expect(forestPaintAmount(p,x,y,z)).toBeCloseTo(.5);expect(forestPaintBehind(p,x,y,z)).toBe(0);
   for(const dz of [-1,-.5,-.1,0,.1,.5,1])if(forestPaintBehind(p,x,y,z+dz)>0)expect(forestPaintAmount(p,x,y,z+dz)).toBe(1);
  }
 });
 it('suppresses visible motes and their matching real lamps until their own positions are painted',()=>{
  const lights=createForestLights(new THREE.Scene());
  for(const t of [4,8,10,12,14,17]){
   const p=forestPaintProgress(t),result=lights.update(t,1,true,720,p),lamps=lights.root.children.filter(o=>o instanceof THREE.PointLight) as THREE.PointLight[];
   if(!p){expect(result.visible).toBe(0);expect(result.lamps).toBe(0);}
   for(let i=0;i<3;i++){const mote=forestMote(i,t);if(lamps[i].intensity>0)expect(forestPaintAmount(p,mote.x,mote.y,mote.z)).toBe(1);else if(forestPaintBehind(p,mote.x,mote.y,mote.z)===0)expect(lamps[i].intensity).toBe(0);}
  }
  lights.dispose();
 });
 it('links the film mask to actual material uniforms and restores ordinary paper outside the film',()=>{
  const paint=createBookPaint(new THREE.Texture(),()=>{}),material=new THREE.MeshStandardMaterial(),paper=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);paper.userData.bookPaper=true;paint.attach(paper,2,true);
  const shader={vertexShader:'#include <project_vertex>',fragmentShader:'void main() {\n#include <opaque_fragment>\n}',uniforms:{}} as THREE.WebGLProgramParametersWithUniforms;material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
  paint.setForestPaint(2,.4);expect(shader.uniforms.forestPaintEnabled.value).toBe(1);expect(shader.uniforms.forestPaintProgress.value).toBe(.4);expect(shader.uniforms.bookPaintFilmOnly.value).toBe(1);
  paint.setForestPaint(2,undefined);expect(shader.uniforms.forestPaintEnabled.value).toBe(0);
 });
 it('keeps camera aims close to the advancing color line with a slower core flight',()=>{
  const shots=forestFilmShots(),initial=shots[0].shot;
  for(let t=11200;t<=14200;t+=50){const shot=sampleBookCamera(shots,initial,t).shot,[x,y,z]=shot.target,front=forestPaintFront(forestPaintProgress(t/1000),x,y);expect(Math.abs(z-front)).toBeLessThan(.85);const later=sampleBookCamera(shots,initial,t+10).shot;expect(new THREE.Vector3(...later.position).distanceTo(new THREE.Vector3(...shot.position))/.01).toBeLessThan(2.4);expect(Math.abs(shot.roll??0)).toBeLessThanOrEqual(2);}
 });
});
