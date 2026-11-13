import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createGroundsWater,groundsShoreDistance,groundsWaterBudget} from './castleWaterSurface';
import {applyWatercolor} from './castleWatercolor';

describe('castle painted water',()=>{
  it('isolates the passive wave phase to page 119 without swimming reflection UVs',()=>{
    for(const movingReflections of [false,true]) {
      const material=applyWatercolor(new THREE.MeshLambertMaterial());
      const water=createGroundsWater(material,'medium',false,{movingReflections});
      const shader={vertexShader:THREE.ShaderLib.lambert.vertexShader,fragmentShader:THREE.ShaderLib.lambert.fragmentShader,uniforms:THREE.UniformsUtils.clone(THREE.ShaderLib.lambert.uniforms)};
      material.onBeforeCompile(shader as Parameters<THREE.Material['onBeforeCompile']>[0],{} as THREE.WebGLRenderer);
      water.update(12);
      if(movingReflections) {
        expect(shader.uniforms.uWaterRippleTime.value).toBe(12);
        expect(shader.fragmentShader).toContain('waterRippleSlope=gentleWaterSlope(wp,uWaterRippleTime)');
        expect(shader.fragmentShader).not.toContain('refractedPoint');
        water.update(14);
        expect(shader.uniforms.uWaterRippleTime.value).toBe(14);
      } else {
        expect(shader.uniforms.uWaterRippleTime).toBeUndefined();
        expect(shader.fragmentShader).not.toContain('refractedPoint');
      }
      expect(water.diagnostics).toMatchObject({reflectionSize:256,reflectionHz:12,captures:0,movingReflections});
      water.setLow();
    }
  });
  it('keeps page 119 paint moving on Low without reflection targets and freezes reduced motion',()=>{
    for(const reduced of [false,true]) {
      const material=applyWatercolor(new THREE.MeshLambertMaterial());
      const water=createGroundsWater(material,'medium',reduced,{movingReflections:true});
      const shader={vertexShader:THREE.ShaderLib.lambert.vertexShader,fragmentShader:THREE.ShaderLib.lambert.fragmentShader,uniforms:THREE.UniformsUtils.clone(THREE.ShaderLib.lambert.uniforms)};
      material.onBeforeCompile(shader as Parameters<THREE.Material['onBeforeCompile']>[0],{} as THREE.WebGLRenderer);
      water.setLow();water.update(20);
      expect(shader.uniforms.uWaterTime.value).toBe(reduced?0:20);
      expect(water.diagnostics).toMatchObject({reflectionSize:0,reflectionHz:0,captures:0,animated:!reduced,rippleTime:reduced?0:20});
    }
  });
  it('uses the shoreline without drawing a seam across the inlet/moat join',()=>{
    expect(groundsShoreDistance(0,43)).toBeCloseTo(0);
    expect(groundsShoreDistance(0,57)).toBeCloseTo(0);
    expect(groundsShoreDistance(0,50)).toBeCloseTo(7);
    expect(groundsShoreDistance(-53,-48)).toBeGreaterThan(5);
  });
  it('bounds the reflection texture and cadence independently of display resolution',()=>{
    expect(groundsWaterBudget('low').size).toBe(0);
    expect(groundsWaterBudget('auto')).toEqual({size:256,hz:12});
    expect(groundsWaterBudget('medium')).toEqual({size:256,hz:12});
    expect(groundsWaterBudget('high')).toEqual({size:384,hz:18});
  });
  it('allocates no reflection targets on Low and releases them on automatic fallback',()=>{
    const low=createGroundsWater(applyWatercolor(new THREE.MeshLambertMaterial()),'low',false);
    expect(low.diagnostics).toMatchObject({reflectionSize:0,reflectionHz:0,captures:0,animated:false});
    const medium=createGroundsWater(applyWatercolor(new THREE.MeshLambertMaterial()),'medium',false);
    expect(medium.diagnostics.reflectionSize).toBe(256);
    medium.setLow();medium.update(30);
    expect(medium.diagnostics).toMatchObject({reflectionSize:0,reflectionHz:0,captures:0,animated:false});
    medium.setLow();
  });
  it('freezes wash motion for reduced motion while retaining camera-responsive reflection capability',()=>{
    const water=createGroundsWater(applyWatercolor(new THREE.MeshLambertMaterial()),'medium',true);
    water.update(10);
    expect(water.diagnostics).toMatchObject({reflectionSize:256,animated:false});
    water.setLow();
  });
});
