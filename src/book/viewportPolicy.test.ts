import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {BOOK_AUTHORING_FRAME,adaptAuthoredShot,authorBookShot,renderPixelRatio,validShotComposition} from './viewportPolicy';
import {validBookStep,type BookCameraShot} from './bookCamera';
import {applySafeProjection} from './responsiveFraming';

describe('book authoring frame',()=>{
 const shot:BookCameraShot={position:[3,12,14],target:[-2,.2,-1],fov:38,composition:{...BOOK_AUTHORING_FRAME}};
 for(const [width,height,safe] of [[1920,1080,{x:0,y:0,width:1920,height:1080}],[390,844,{x:12,y:60,width:366,height:760}],[1600,900,{x:320,y:70,width:1200,height:800}]] as const){
  it(`round trips authored shots through ${width}×${height} without camera drift`,()=>{
   const fitted=adaptAuthoredShot(shot,{height},safe),saved=authorBookShot(fitted,{height},safe);
   saved.position.forEach((v,i)=>expect(v).toBeCloseTo(shot.position[i],10));expect(saved.target).toEqual(shot.target);expect(saved.fov).toBe(shot.fov);expect(saved.composition).toEqual(BOOK_AUTHORING_FRAME);
   const a=new THREE.Vector3(...shot.position).sub(new THREE.Vector3(...shot.target)).normalize(),b=new THREE.Vector3(...fitted.position).sub(new THREE.Vector3(...fitted.target)).normalize();expect(a.distanceTo(b)).toBeLessThan(1e-10);
   const camera=new THREE.PerspectiveCamera(fitted.fov,width/height,.1,1000);camera.position.fromArray(fitted.position);camera.lookAt(new THREE.Vector3(...fitted.target));applySafeProjection(camera,{width,height},safe);camera.updateMatrixWorld();const p=new THREE.Vector3(...fitted.target).project(camera);expect((p.x*.5+.5)*width).toBeCloseTo(safe.x+safe.width/2);expect((-.5*p.y+.5)*height).toBeCloseTo(safe.y+safe.height/2);
  });
 }
 it('preserves the camera at the reference viewport and supports legacy shots',()=>{
  expect(adaptAuthoredShot(shot,{height:1080},{x:0,y:0,width:1920,height:1080}).position).toEqual(shot.position);
  const legacy={...shot};delete legacy.composition;
  expect(adaptAuthoredShot(legacy,{height:844},{x:0,y:0,width:390,height:844}).position).toEqual(adaptAuthoredShot(shot,{height:844},{x:0,y:0,width:390,height:844}).position);
  const step={name:'Shot',shot:legacy,durationMs:1000,holdMs:0,easing:'smooth'};expect(validBookStep(step)).toBe(true);expect(validBookStep({...step,shot})).toBe(true);
  for(const composition of [{width:0,height:1080},{width:1920,height:NaN},{width:Infinity,height:1080}]){expect(validShotComposition(composition)).toBe(false);expect(validBookStep({...step,shot:{...shot,composition}})).toBe(false);}
 });
 it('budgets rendering pixels independently of logical dimensions or camera',()=>{
  const before=structuredClone(shot);
  for(const quality of ['auto','low','medium','high'] as const){const ratio=renderPixelRatio(3840,2160,3,quality);expect(ratio).toBeGreaterThan(0);if(quality==='auto')expect(3840*2160*ratio*ratio).toBeLessThanOrEqual(1920*1080+1);}
  expect(renderPixelRatio(1280,720,2,'low')).toBeLessThan(renderPixelRatio(1280,720,2,'high'));expect(shot).toEqual(before);
 });
});
