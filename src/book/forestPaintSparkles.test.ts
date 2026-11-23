import {describe,it,expect,vi,afterEach} from 'vitest';
import * as THREE from 'three';
import {createForestPaintSparkles} from './forestPaintSparkles';
import {ProximityPaint} from './proximityPaint';

afterEach(()=>vi.unstubAllGlobals());
describe('shared surface paint sparkles',()=>{
  it('follows a castle-sized pigment field and preserves sampled warm hues within its budget',()=>{
    const pixels=new Uint8ClampedArray(64*64*4);for(let i=0;i<pixels.length;i+=4)pixels.set([150,90,30,255],i);
    vi.stubGlobal('document',{createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:pixels})})})});
    const scene=new THREE.Scene(),root=new THREE.Group(),map=new THREE.Texture({getContext(){}} as unknown as HTMLCanvasElement);
    root.add(new THREE.Mesh(new THREE.PlaneGeometry(16,24).rotateX(-Math.PI/2).translate(0,.1,47),new THREE.MeshBasicMaterial({map})));scene.add(root);
    const sparkles=createForestPaintSparkles(scene,{maxSamples:4000,pointScale:8});sparkles.configure(root);
    const field=new ProximityPaint(new THREE.Vector4(-9,34,18,27)),hero=new THREE.Vector3(0,0,59);
    field.update(2,hero,1);field.update(2.7,hero,1);
    const state=sparkles.update(2.7,0,1,true,720,field);
    expect(state.active).toBeGreaterThan(0);expect(state.samples).toBeGreaterThan(0);expect(state.samples).toBeLessThanOrEqual(4000);
    expect(sparkles.points.material.uniforms.forestProximityBounds.value.toArray()).toEqual(field.bounds.toArray());
    const color=sparkles.points.geometry.attributes.color;expect(color.getX(0)).toBeGreaterThan(color.getY(0));expect(color.getY(0)).toBeGreaterThan(color.getZ(0));
    sparkles.configure(root);expect(sparkles.sourceReads).toBe(1);
    sparkles.update(2.7,0,1,false,720,field);expect(sparkles.points.visible).toBe(false);
    field.update(5,hero,1);sparkles.update(5,0,1,true,720,field);expect(sparkles.points.visible).toBe(false);
    sparkles.dispose();field.dispose();
  });
});
