import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createFlurryStorm,flurryCuriosity,FLURRY_STORM} from './flurryWorldEffects';
it('keeps snowfall local, terrain-bound and capped without animation buffer uploads',()=>{
 const root=new THREE.Group(),point=new THREE.Vector3(10,3,78),storm=createFlurryStorm(root,point,false,(x,z)=>3+(x-10)*.2+(z-78)*.1);
 const geometry=storm.mesh.geometry,origin=geometry.attributes.flakeOrigin as THREE.InstancedBufferAttribute;
 expect(geometry.instanceCount).toBe(768);expect(storm.diagnostics.height).toBe(26);
 for(let i=0;i<origin.count;i++){expect(Math.hypot(origin.getX(i),origin.getZ(i))).toBeLessThanOrEqual(FLURRY_STORM.radius);expect(origin.getY(i)).toBeCloseTo(origin.getX(i)*.2+origin.getZ(i)*.1,6);}
 const version=origin.version;storm.update(12);expect(storm.diagnostics.time).toBe(12);storm.update(13);expect(origin.version).toBe(version);
 storm.update(20,true);expect(storm.diagnostics.time).toBe(0);expect(storm.mesh.material.depthTest).toBe(true);expect(storm.mesh.material.depthWrite).toBe(false);
 storm.setLow();expect(geometry.instanceCount).toBe(384);storm.dispose();expect(root.children).toHaveLength(0);
});
it('makes bounded, smoothly changing random glances and freezes reduced motion',()=>{
 let maximumX=-Infinity,minimumX=Infinity;
 for(let t=0;t<100;t+=.05){const pose=flurryCuriosity(t),next=flurryCuriosity(t+.001);maximumX=Math.max(maximumX,pose.x);minimumX=Math.min(minimumX,pose.x);expect(Math.abs(pose.x)).toBeLessThanOrEqual(1);expect(Math.abs(pose.y)).toBeLessThanOrEqual(1);expect(Math.abs(pose.x-next.x)).toBeLessThan(.003);}
 expect(maximumX-minimumX).toBeGreaterThan(1);expect(flurryCuriosity(7,true)).toEqual(flurryCuriosity(70,true));
});
