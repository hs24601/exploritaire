import {it,expect} from 'vitest';
import * as THREE from 'three';
import {PACKET_WIDTH,PACKET_HEIGHT,plankPacketMaterial,plankPacket} from './castlePlankPacket';
it('shares packet geometry and live lantern uniforms without adding scene lights',()=>{
  const lights={positions:Array.from({length:6},()=>new THREE.Vector3()),power:{value:[1,1,1,1,1,1]}},material=plankPacketMaterial(new THREE.Texture(),lights);
  const a=plankPacket(material),b=plankPacket(material);expect(a.geometry).toBe(b.geometry);expect(a.material).toBe(b.material);expect(PACKET_WIDTH/PACKET_HEIGHT).toBeCloseTo(63/88,12);
  const shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader,uniforms:THREE.UniformsUtils.clone(THREE.ShaderLib.basic.uniforms)};
  material.onBeforeCompile(shader as Parameters<THREE.Material['onBeforeCompile']>[0],{} as THREE.WebGLRenderer);
  expect(shader.uniforms.packetLamps.value).toBe(lights.positions);expect(shader.uniforms.packetLampPower).toBe(lights.power);
  lights.power.value[0]=.9;expect(shader.uniforms.packetLampPower.value[0]).toBe(.9);expect(shader.fragmentShader).toContain('metal+=power');
});
