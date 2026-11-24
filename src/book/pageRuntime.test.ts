import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createBookPageRuntime,pageControlGroup} from './pageRuntime';
import {defaultRegionPaint} from './regionPaint';
describe('page property bridge',()=>{
 it('keeps real page pigment visible when region guides are hidden and preserves it through delete/undo',async()=>{
  const root=new THREE.Group(),runtime=createBookPageRuntime([root],async()=>{throw Error('unexpected prop')},()=>{},()=>{});
  const layout=runtime.defaults[0],control={id:'wash',name:'Page wash',kind:'paint-region' as const,x:1,z:-1,elevation:0,width:3,height:2,rotation:30,visible:true,locked:false,opacity:1,layer:0,paintState:'painted' as const,regionPaint:defaultRegionPaint()};layout.controls.push(control);
  await runtime.apply(layout);const binding=runtime.binding(0,'wash')!;expect(binding.surface?.visible).toBe(true);expect(binding.surface?.userData.editorHelper).toBeUndefined();runtime.regionEditing(0,true);expect(binding.mesh.visible).toBe(true);runtime.regionEditing(0,false);expect(binding.mesh.visible).toBe(false);expect(binding.surface?.visible).toBe(true);
  control.width=5;control.height=4;await runtime.apply(layout);expect(binding.surface?.geometry.parameters.width).toBe(5);expect(binding.surface?.geometry.parameters.height).toBe(4);
  await runtime.apply({...layout,controls:[]});expect(binding.root.visible).toBe(false);await runtime.apply(layout);expect(binding.root.visible).toBe(true);expect(binding.surface?.visible).toBe(true);
 });

 it('groups extents across both leaves, including exact page-edge contact',()=>{expect(pageControlGroup(-4,-1)).toBe('Left page');expect(pageControlGroup(1,4)).toBe('Right page');expect(pageControlGroup(-1,2)).toBe('Cross-page');expect(pageControlGroup(-.05,.05)).toBe('Cross-page');});
 it('selects existing printed text directly through its page control identity',()=>{
  const root=new THREE.Group(),text=new THREE.Mesh(new THREE.PlaneGeometry(4,1),new THREE.MeshBasicMaterial());text.rotation.x=-Math.PI/2;text.position.set(-2,.154,2);Object.assign(text.userData,{bookStory:true,storyId:'home:left',storyText:'Existing printed prose',storyAnchor:text.position.toArray()});root.add(text);
  const runtime=createBookPageRuntime([root],async()=>{throw Error('unexpected creation')},()=>{},()=>{});root.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(-2,10,2),new THREE.Vector3(0,-1,0));expect(runtime.hit(0,ray)).toBe('home:left');expect(runtime.defaults[0].controls[0].text).toBe('Existing printed prose');
 });
 it('edits nested foldout props in world space without accumulating scale, and retains bindings for undo',async()=>{
  const root=new THREE.Group(),wing=new THREE.Group();wing.position.set(4,.15,-1);wing.rotation.y=.4;root.add(wing);const hinge=new THREE.Group();hinge.userData.bookProp={art:'environment/rock.png'};wing.add(hinge);const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,3),new THREE.MeshBasicMaterial());hinge.add(mesh);
  const runtime=createBookPageRuntime([root],async()=>{throw Error('unexpected creation')},()=>{},()=>{}),layout=runtime.defaults[0],control=layout.controls[0];control.x=2;control.z=-2;control.width=4;control.height=6;control.fold='flat';await runtime.apply(layout);root.updateMatrixWorld(true);expect(hinge.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(2);expect(hinge.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(-2);expect(hinge.scale.x).toBeCloseTo(2);expect(hinge.userData.pageFlat).toBe(true);await runtime.apply(layout);expect(hinge.scale.x).toBeCloseTo(2);
  await runtime.apply({...layout,controls:[]});expect(hinge.visible).toBe(false);await runtime.apply(layout);expect(hinge.visible).toBe(true);expect(runtime.binding(0,control.id)?.root).toBe(hinge);
 });
});
