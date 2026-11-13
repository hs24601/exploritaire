import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createBookStoryPresentation } from './storyPresentation';
describe('book text states',()=>{
 it('defaults to printed placement at every camera angle and can switch back from popup',()=>{
  const root=new THREE.Group();const panel=new THREE.Mesh(new THREE.PlaneGeometry(4,1),new THREE.MeshBasicMaterial());panel.userData={bookStory:true,storyId:'den:left',storyAnchor:[-2,.154,2],storyHeight:1};root.add(panel);
  const controller=createBookStoryPresentation([root]),camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(0,2,12);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  controller.update(camera,root,.1,true);expect(controller.getState('den:left')).toBe('locked-to-page');expect(panel.position.toArray()).toEqual([-2,.154,2]);expect(panel.rotation.x).toBeCloseTo(-Math.PI/2);
  expect(controller.setState('den:left','camera-popup')).toBe(true);controller.update(camera,root,.1,true);expect(panel.position.y).toBeGreaterThan(.154);
  controller.setState('den:left','locked-to-page');controller.update(camera,root,.1,true);expect(panel.position.toArray()).toEqual([-2,.154,2]);expect(panel.rotation.x).toBeCloseTo(-Math.PI/2);expect(controller.setState('missing','camera-popup')).toBe(false);
 });
});
