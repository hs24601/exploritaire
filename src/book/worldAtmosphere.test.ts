import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createBasinMist,perimeterMistRegion} from './basinMist';
import {smokeRise,createSmokeWisps} from './worldSmokeWisps';
import {freshWorldStudioDocument,validWorldStudioDocument,STUDIO_ATMOSPHERE_DEFAULTS} from './worldStudioDocument';
describe('bright localized grove atmosphere',()=>{
 it('leaves the central tree clear while fog remains at the perimeter and waterfall',()=>{
  expect(perimeterMistRegion(0,-42)).toBe(0);expect(perimeterMistRegion(0,0)).toBe(0);
  expect(perimeterMistRegion(105,0)).toBeGreaterThan(.9);expect(perimeterMistRegion(-72,-78)).toBe(1);
  const root=new THREE.Group(),mist=createBasinMist(root,()=>0,new Set(),{localized:true});
  expect(root.getObjectByName('basin-upper-air-mist')!.visible).toBe(false);
  expect(root.getObjectByName('basin-low-drifting-mist')!.visible).toBe(true);
  expect(mist.diagnostics.localized).toBe(true);
 });
 it('supports old recipes and validates new saved smoke options',()=>{
  const doc=freshWorldStudioDocument();delete doc.atmosphere;expect(validWorldStudioDocument(doc)).toBe(true);
  doc.atmosphere={...STUDIO_ATMOSPHERE_DEFAULTS,smokeWisps:true};expect(validWorldStudioDocument(doc)).toBe(true);
  doc.atmosphere.buoyancy=Infinity;expect(validWorldStudioDocument(doc)).toBe(false);
 });
 it('cooling slows buoyant rise and zero heat does not rise',()=>{
  expect(smokeRise(3,0)).toBe(0);expect(smokeRise(3,3,.6)).toBeLessThan(smokeRise(3,3,0));
  expect(smokeRise(4,3)).toBeGreaterThan(smokeRise(3,3));
 });
 it('toggles a bounded shared batch without regenerating per-particle buffers',()=>{
  const root=new THREE.Group(),texture=new THREE.Texture(),effect=createSmokeWisps(root,{texture,heightMap:texture,terrainSize:161},()=>true);
  const positions=effect.mesh.geometry.attributes.smokeOrigin as THREE.InstancedBufferAttribute,version=positions.version;
  expect(effect.mesh.visible).toBe(false);effect.apply({...STUDIO_ATMOSPHERE_DEFAULTS,smokeWisps:true});effect.update(5);effect.update(5);
  expect(effect.mesh.visible).toBe(true);expect(positions.version).toBe(version);expect(effect.mesh.geometry.instanceCount).toBe(192);
  effect.setLow();expect(effect.mesh.geometry.instanceCount).toBe(96);effect.apply(STUDIO_ATMOSPHERE_DEFAULTS);expect(effect.mesh.visible).toBe(false);effect.dispose();expect(root.children).toHaveLength(0);
 });
});
