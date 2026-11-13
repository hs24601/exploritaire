import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {viewportElementPlacement} from './elementPlacement';
import {applySafeProjection} from './responsiveFraming';
describe('new controls in the current view',()=>{
 for(const [width,height,safe]of [[1440,900,{x:312,y:78,width:740,height:810}],[390,844,{x:12,y:60,width:318,height:390}]] as const){
  it(`places all control kinds in the visible page portion at ${width}×${height}`,()=>{
   const camera=new THREE.PerspectiveCamera(38,width/height,.1,100);camera.position.set(-3,3,1);camera.lookAt(-3,.154,-2);applySafeProjection(camera,{width,height},safe);camera.updateMatrixWorld();
   const before=camera.position.toArray();
   for(const kind of ['text','prop','paint-region']as const){const at=viewportElementPlacement(camera,{width,height},safe,1,kind,kind==='prop'?1.4:3,kind==='prop'?2.2:kind==='text'?1.1:3)!;expect(at).toBeDefined();expect(at.x).toBeLessThan(-1);expect(at.width).toBeLessThanOrEqual(kind==='prop'?1.4:3);const y=kind==='text'?.154:.15,center=new THREE.Vector3(at.x,y+(kind==='prop'?at.height/2:0),at.z).project(camera),px=(center.x*.5+.5)*width,py=(-center.y*.5+.5)*height;expect(px).toBeGreaterThan(safe.x);expect(px).toBeLessThan(safe.x+safe.width);expect(py).toBeGreaterThan(safe.y);expect(py).toBeLessThan(safe.y+safe.height);}
   expect(camera.position.toArray()).toEqual(before);
  });
 }
 it('shrinks a flat control to keep every corner on screen when zoomed in',()=>{
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(-3,1.3,-1.999);camera.lookAt(-3,.154,-2);camera.updateMatrixWorld();const viewport={width:600,height:600},safe={x:20,y:20,width:560,height:560};const at=viewportElementPlacement(camera,viewport,safe,1,'text',3,1.1)!;expect(at.scale).toBeLessThan(1);for(const dx of [-at.width/2,at.width/2])for(const dz of [-at.height/2,at.height/2]){const p=new THREE.Vector3(at.x+dx,.154,at.z+dz).project(camera);expect(Math.abs(p.x)).toBeLessThan(.94);expect(Math.abs(p.y)).toBeLessThan(.94);}
 });
 it('does not create an off-screen element when no usable page is visible',()=>{const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(50,3,50);camera.lookAt(50,.154,48);camera.updateMatrixWorld();expect(viewportElementPlacement(camera,{width:600,height:600},{x:0,y:0,width:600,height:600},1,'text',3,1.1)).toBeUndefined();});
 it('places cover controls on its own visible sheet',()=>{const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(3,7,4);camera.lookAt(3,.215,0);camera.updateMatrixWorld();const at=viewportElementPlacement(camera,{width:600,height:600},{x:0,y:0,width:600,height:600},0,'paint-region',3,3)!;expect(at.x-at.width/2).toBeGreaterThanOrEqual(.18);expect(at.x+at.width/2).toBeLessThanOrEqual(5.67);});
});
