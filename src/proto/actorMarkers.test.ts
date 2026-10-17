import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {markerFraction,markerRows,markerScale} from './actorMarkers';
import {createActorMarkers} from './actorMarkersThree';
afterEach(()=>vi.unstubAllGlobals());
function setup() {
 const context={save:vi.fn(),restore:vi.fn(),beginPath:vi.fn(),roundRect:vi.fn(),rect:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),fill:vi.fn(),clip:vi.fn(),stroke:vi.fn(),createLinearGradient:()=>({addColorStop:vi.fn()}),clearRect:vi.fn(),fillRect:vi.fn(),strokeText:vi.fn(),fillText:vi.fn(),measureText:(text:string)=>({width:text.length*20})};
 vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>context})});
 const actor=new THREE.Group(), billboard=new THREE.Group(), facing=new THREE.Group();actor.add(billboard);billboard.add(facing);facing.scale.x=-1;
 const geometry=new THREE.PlaneGeometry(1,1), marker=createActorMarkers(billboard,geometry);
 const camera=new THREE.PerspectiveCamera(45,1.5,.1,100);camera.position.set(0,3,10);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 marker.setContent({health:{current:7,max:14}});
 return {actor,billboard,marker,camera,geometry,context};
}
describe('floating actor markers',()=>{
 it('paints the predicted loss band and clears it without changing actual HP',()=>{
  const {marker,geometry,context}=setup();
  marker.setContent({health:{current:7,max:14,preview:0}});
  expect(context.fillText.mock.calls[context.fillText.mock.calls.length - 1]?.[0]).toBe('HP 7→0');
  expect(context.rect).toHaveBeenCalledWith(7,7,121,46);
  expect(marker.snapshot().content[0]).toMatchObject({meter:{current:7,max:14,preview:0}});
  marker.setContent({health:{current:7,max:14}});
  expect(context.fillText.mock.calls[context.fillText.mock.calls.length - 1]?.[0]).toBe('HP 7/14');
  marker.dispose();geometry.dispose();
 });
 it('provides ordered extensible meter/label rows and clamps health safely',()=>{
  expect(markerRows({health:{current:3,max:12},rows:[{id:'ap',kind:'meter',meter:{current:8,max:10}},{id:'bleed',kind:'label',text:'Bleeding'}]}).map(r=>r.id)).toEqual(['health','ap','bleed']);
  expect(markerFraction({current:20,max:12})).toBe(1);expect(markerFraction({current:-2,max:12})).toBe(0);expect(markerFraction({current:1,max:0})).toBe(0);
  expect(markerScale(50)).toBe(104/50);expect(markerScale(120)).toBe(1);expect(markerScale(300)).toBe(156/300);
 });
 it('follows the sprite anchor while keeping the panel camera-facing and unmirrored',()=>{
  const {actor,billboard,marker,camera,geometry}=setup();
  billboard.rotation.set(-.2,.3,0);marker.update(camera,1200,800,2,true);const before=marker.snapshot();
  actor.position.set(2,0,1);marker.update(camera,1200,800,2,true);const after=marker.snapshot();
  expect(after.position[0]-before.position[0]).toBeCloseTo(2);expect(after.position[2]-before.position[2]).toBeCloseTo(1);
  expect(marker.root.parent).toBe(billboard);expect(marker.root.scale.x).toBe(1);
  marker.dispose();geometry.dispose();
 });
 it('keeps all four edges rectangular at close, off-axis and overhead camera angles',()=>{
  const {actor,billboard,marker,camera,geometry}=setup();
  actor.position.set(2,0,0);billboard.rotation.set(-1.1,.8,.2);
  const panel=marker.root.children[0] as THREE.Mesh;
  for(const position of [[0,3,5],[7,4,7],[0,18,.05],[-7,3,8]]) {
   camera.position.fromArray(position);camera.lookAt(0,1,0);camera.updateMatrixWorld();
   marker.update(camera,1200,800,2,true);panel.updateWorldMatrix(true,false);
   const corners=[[-.5,.5],[.5,.5],[.5,-.5],[-.5,-.5]].map(([x,y])=>panel.localToWorld(new THREE.Vector3(x,y,0)).project(camera));
   expect(corners[0].y).toBeCloseTo(corners[1].y,10);expect(corners[2].y).toBeCloseTo(corners[3].y,10);
   expect(corners[0].x).toBeCloseTo(corners[3].x,10);expect(corners[1].x).toBeCloseTo(corners[2].x,10);
   const width=(corners[1].x-corners[0].x)*600,height=(corners[0].y-corners[3].y)*400;
   expect(width/height).toBeCloseTo(4,8);expect(width).toBeGreaterThanOrEqual(103.999);expect(width).toBeLessThanOrEqual(156.001);
   const bottom=panel.localToWorld(new THREE.Vector3(0,-.5,0));
   expect(bottom.distanceTo(marker.root.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-10);
  }
  marker.dispose();geometry.dispose();
 });
 it('repaints only changed content, keeps 0 HP, and releases owned resources',()=>{
  const {marker,camera,geometry,context}=setup();const painted=context.fillText.mock.calls.length;
  for(let frame=0;frame<10;frame++){marker.setContent({health:{current:7,max:14}});marker.update(camera,1200,800,2,true);}
  expect(context.fillText.mock.calls.length).toBe(painted);expect(marker.snapshot().revision).toBe(1);
  marker.setContent({health:{current:0,max:14}});marker.update(camera,1200,800,2,true);expect(marker.snapshot().visible).toBe(true);
  marker.update(camera,1200,800,2,false);expect(marker.snapshot().visible).toBe(false);
  const panel=marker.root.children[0] as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
  const disposeTexture=vi.spyOn(panel.material.map!,'dispose'),disposeMaterial=vi.spyOn(panel.material,'dispose'),disposeGeometry=vi.spyOn(geometry,'dispose');
  marker.dispose();expect(marker.root.parent).toBeNull();expect(disposeTexture).toHaveBeenCalledOnce();expect(disposeMaterial).toHaveBeenCalledOnce();expect(disposeGeometry).not.toHaveBeenCalled();geometry.dispose();
 });
});
