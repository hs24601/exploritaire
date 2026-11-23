import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {fitBookBounds,frameCorners,applySafeProjection,validBookFraming} from './responsiveFraming';
import {validBookStep,type BookCameraShot} from './bookCamera';
describe('responsive book framing',()=>{
 const bounds=new THREE.Box3(new THREE.Vector3(-6,-.4,-4),new THREE.Vector3(6,4,4));
 for(const [name,width,height,safe] of [['desktop',1600,1000,{x:320,y:90,width:950,height:820}],['phone',390,844,{x:12,y:160,width:366,height:560}],['landscape',844,390,{x:100,y:60,width:700,height:250}]] as const){
  it('fits every corner inside the '+name+' safe area at overhead and low angles',()=>{
   for(const position of [[0,20,.00001],[0,3,15],[4,12,10]] as [number,number,number][]){const shot:BookCameraShot={position,target:[0,.2,0],fov:38},fitted=fitBookBounds(bounds,shot,{width,height},safe,.08);const camera=new THREE.PerspectiveCamera(38,width/height,.1,1000);camera.position.fromArray(fitted.position);camera.lookAt(new THREE.Vector3(...fitted.target));applySafeProjection(camera,{width,height},safe);camera.updateMatrixWorld();for(const p of frameCorners(bounds)){p.project(camera);const x=(p.x*.5+.5)*width,y=(-p.y*.5+.5)*height;expect(x).toBeGreaterThanOrEqual(safe.x-1e-4);expect(x).toBeLessThanOrEqual(safe.x+safe.width+1e-4);expect(y).toBeGreaterThanOrEqual(safe.y-1e-4);expect(y).toBeLessThanOrEqual(safe.y+safe.height+1e-4);}const center=new THREE.Vector3(...fitted.target).project(camera);expect((center.x*.5+.5)*width).toBeCloseTo(safe.x+safe.width/2);expect((-.5*center.y+.5)*height).toBeCloseTo(safe.y+safe.height/2);}
  });
 }
 it('supports old shots and validates portable subject framing',()=>{const shot={position:[0,10,10],target:[0,0,0],fov:38},step={name:'View',shot,durationMs:1000,holdMs:0,easing:'smooth'};expect(validBookStep(step)).toBe(true);expect(validBookStep({...step,shot:{...shot,framing:{subject:'book',margin:.1}}})).toBe(true);expect(validBookFraming({subject:'control',controlId:'home:left',margin:.1})).toBe(true);for(const bad of [{subject:'control',margin:.1},{subject:'book',margin:NaN},{subject:'book',margin:1},{subject:'other',margin:.1}])expect(validBookStep({...step,shot:{...shot,framing:bad}})).toBe(false);});
});
