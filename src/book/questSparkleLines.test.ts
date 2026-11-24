import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createQuestSparkleLines,sampleQuestFloorPath} from './questSparkleLines';

describe('world quest sparkle guides',()=>{
  it('shares one fixed particle batch, follows live objects, and retires collected targets',()=>{
    const scene=new THREE.Scene(),targets=[new THREE.Vector3(-12,2.3,60.5),new THREE.Vector3(-8.8,2.3,62.5),new THREE.Vector3(11.8,2.3,60.5)],lines=createQuestSparkleLines(scene,targets,false,true);
    const positions=lines.points.geometry.attributes.position as THREE.BufferAttribute,version=positions.version;
    lines.update(.5,{x:0,y:.5,z:75},[true,true,true],true,720);
    expect(lines.diagnostics).toMatchObject({draws:1,targets:3,particles:288,newLights:0,animated:true});
    const floorMap=lines.points.material.uniforms.questFloor.value as THREE.DataTexture,field=floorMap.image.data,textureVersion=floorMap.version;
    expect(field[1]).toBeCloseTo(.045);expect(field[32*4+1]).toBeCloseTo(.045);
    targets[1].y=3;lines.update(.1,{x:0,y:10,z:75},[true,true,true],true,720);expect(floorMap.version).toBe(textureVersion);
    lines.update(1,{x:1,z:70},[false,true,false],true,720);expect(lines.diagnostics.targets).toBe(1);
    expect(positions.version).toBe(version);expect(lines.points.userData.skipWaterReflection).toBe(true);
    lines.update(.1,{x:1,z:70},[true,true,true],false,720);expect(lines.points.visible).toBe(false);lines.dispose();expect(scene.children).toHaveLength(0);
  });
  it('projects every guide sample to the floor and marks unsupported ground as a gap',()=>{
    const data=new Float32Array(33*4);
    sampleQuestFloorPath({x:0,z:0},{x:12,z:10},(x,z)=>x>5&&x<7?undefined:z*.1,33,data);
    let gaps=0;for(let i=0;i<33;i++){const at=i*4;if(!data[at+3])gaps++;else expect(data[at+1]).toBeCloseTo(data[at+2]*.1+.045,5);}
    expect(gaps).toBeGreaterThan(0);expect(data[32*4+1]).toBeCloseTo(1.045);
  });
  it('keeps a static readable guide with reduced motion and bounds target count',()=>{
    const scene=new THREE.Scene(),lines=createQuestSparkleLines(scene,[new THREE.Vector3(2,2,5)],true);
    lines.update(.5,{x:0,z:0},[true],true,720);lines.update(2,{x:1,z:0},[true],true,720);
    expect(lines.points.material.uniforms.questTime.value).toBe(0);expect(lines.points.visible).toBe(true);expect(lines.diagnostics.animated).toBe(false);
    expect(()=>createQuestSparkleLines(scene,[])).toThrow();expect(()=>createQuestSparkleLines(scene,Array.from({length:9},()=>new THREE.Vector3()))).toThrow();lines.dispose();
  });
});
