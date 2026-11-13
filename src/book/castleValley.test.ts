import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createCastleValley,valleyInnerRadius,valleyHeight,valleyRiverAt,VALLEY_RIVERS,valleyBudget} from './castleValley';
import {groundsWalkable} from './castleGroundsLayout';

describe('decorative castle river valley',()=>{
  it('joins outside the crater and beds both river mouths below the water',()=>{
    for(let i=0;i<32;i++){const r=valleyInnerRadius(i/32*Math.PI*2);expect(r).toBeGreaterThan(100);expect(r).toBeLessThan(200);}
    expect(valleyHeight(valleyInnerRadius(0),0)).toBeCloseTo(-3.35,8);
    for(const river of VALLEY_RIVERS)for(const point of river){const sample=valleyRiverAt(point.x,point.z);expect(sample.distance).toBeCloseTo(0);expect(valleyHeight(point.x,point.z)).toBeLessThan(point.y);}
    expect(VALLEY_RIVERS[0][0]).toMatchObject({x:91.5,z:137,y:-1.6,width:53});
    expect(VALLEY_RIVERS[1][0]).toMatchObject({x:-98,z:-70.5,y:23});
  });
  it('batches a finite landscape into five unlit, non-shadow scenery draws',()=>{
    const valley=createCastleValley('low'),textures=new Set<THREE.Texture>();let lights=0;
    valley.group.traverse(object=>{
      if(object instanceof THREE.Light)lights++;
      expect(object.castShadow).toBe(false);expect(object.receiveShadow).toBe(false);
      if(object instanceof THREE.Mesh){
        expect(object.material).toBeInstanceOf(THREE.MeshBasicMaterial);const material=object.material as THREE.MeshBasicMaterial;if(material.map)textures.add(material.map);
        for(const value of object.geometry.attributes.position.array)expect(Number.isFinite(value)).toBe(true);
      }
    });
    expect(lights).toBe(0);expect(textures.size).toBe(1);expect(valley.diagnostics).toMatchObject({draws:5,trees:96,animated:false,playable:false,newLights:0,villageHouses:13});expect(valley.diagnostics.triangles).toBeLessThan(6500);
    expect(groundsWalkable(111,252)).toBe(false);
  });
  it('reduces only instance count on fallback without rebuilding or uploading scenery',()=>{
    const valley=createCastleValley('medium'),forest=valley.group.children.find(object=>object instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    const version=forest.instanceMatrix.version;expect(valley.diagnostics.trees).toBe(240);expect(valley.diagnostics.triangles).toBeLessThan(12000);
    valley.setLow();expect(valley.diagnostics.trees).toBe(96);expect(forest.instanceMatrix.version).toBe(version);expect(valleyBudget('high').trees).toBe(360);
  });
});
