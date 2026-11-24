import {it,expect} from 'vitest';
import * as THREE from 'three';
import {createWorldTreeGeometryPaint} from './worldTreeGeometryPaint';
it('attaches separate bounded growths, animates uniforms, and leaves wood intact',()=>{
 const parent=new THREE.Group(),wood=new THREE.MeshLambertMaterial({color:'#8c6748',emissiveIntensity:0}),trunk=new THREE.Mesh(new THREE.CylinderGeometry(1,1,8),wood);parent.add(trunk);
 const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(2,2,0),new THREE.Vector3(8,3,1)]),paint=createWorldTreeGeometryPaint(parent,[{curve,radius:1},{curve,radius:.5}]);
 expect(paint.diagnostics.doubleCurtains).toBe(true);expect(paint.diagnostics.reefColonies).toBe(112);expect(paint.diagnostics.draws).toBe(7);expect(wood.emissiveIntensity).toBe(0);
 const reef=paint.root.getObjectByName('reef-staghorn-colonies') as THREE.InstancedMesh,version=reef.instanceMatrix.version;paint.update(5);expect(reef.instanceMatrix.version).toBe(version);expect(paint.diagnostics.time).toBe(5);paint.update(0);expect(paint.diagnostics.time).toBe(0);
 paint.setLow();expect(paint.diagnostics.reefColonies).toBe(64);expect(paint.diagnostics.polyps).toBe(256);const count=reef.count;paint.setLow();expect(reef.count).toBe(count);
 paint.dispose();expect(parent.children).toEqual([trunk]);
});
