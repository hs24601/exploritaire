import {expect,it} from 'vitest';
import * as THREE from 'three';
import {createKhadWeed} from './khadWeedRig';

it('paints all four original Khadroot pigments and retains the hurt/recovery colors',()=>{
 const rig=createKhadWeed(),materials=new Map<number,THREE.MeshStandardMaterial|THREE.MeshBasicMaterial>();
 rig.root.traverse(o=>{if(o instanceof THREE.Mesh){for(const material of Array.isArray(o.material)?o.material:[o.material])if(material.customProgramCacheKey().includes('continuous-mixed-surface-1-true'))materials.set(material.id,material);}});
 expect([...materials.values()].map(m=>m.color.getHexString()).sort()).toEqual(['35443a','422531','c65d70','f34b65']);
 const bark=[...materials.values()].find(m=>m.color.getHexString()==='422531')!;
 rig.hurt(1);rig.update(1.05,false);expect(bark.color.getHexString()).toBe('a65e68');rig.update(2,false);expect(bark.color.getHexString()).toBe('422531');
 expect((bark as THREE.MeshStandardMaterial).emissive.getHexString()).toBe('26121d');
 rig.dispose();
});
