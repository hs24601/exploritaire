import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createPlayerFog,craterMistDensity,fogSampleBudget,playerFogClearance} from './castlePlayerFog';
import {createCastleLanterns} from './castleLanterns';
import {createCastleNightSky,nightStarBudget} from './castleNightSky';

describe('player-centered castle atmosphere',()=>{
  it('surrounds the rim and leaves barely visible silhouettes throughout a deep outer blanket',()=>{
    expect(craterMistDensity(0,1,10)).toBe(0);
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8;
      expect(craterMistDensity(Math.cos(a)*123,3,10+Math.sin(a)*126)).toBeGreaterThan(.009);
      const outer=craterMistDensity(Math.cos(a)*300,24,10+Math.sin(a)*300);
      expect(Math.exp(-outer*100)).toBeLessThan(.03);
      expect(craterMistDensity(Math.cos(a)*300,60,10+Math.sin(a)*300)).toBeGreaterThan(.019);
    }
    expect(craterMistDensity(300,-30,10)).toBe(0);
  });
  it('smoothly clears nearby air and leaves distant darkness dense',()=>{
    expect(playerFogClearance(0)).toBe(.045);
    expect(playerFogClearance(5)).toBe(.045);
    expect(playerFogClearance(14)).toBeGreaterThan(playerFogClearance(6));
    expect(playerFogClearance(24)).toBe(1);
    const fog=createPlayerFog('medium',true,createCastleLanterns(true).lights);
    fog.update(0,12,0,20);const near=fog.densityAt(12,1,20);
    fog.update(0,47,0,20);const far=fog.densityAt(12,1,20);
    expect(far).toBeGreaterThan(near*20);
  });
  it('moves the clearing with Hero, including with reduced motion',()=>{
    const fog=createPlayerFog('medium',true,createCastleLanterns(true).lights);
    fog.update(10,0,0,0);const original=fog.densityAt(0,1,0);
    fog.update(30,40,0,0);
    expect(fog.densityAt(0,1,0)).toBeGreaterThan(original*20);
    expect(fog.diagnostics.player).toEqual([40,.8,0]);
    expect(fog.diagnostics.animated).toBe(false);
    expect(fog.uniforms.uFogTime.value).toBe(0);
  });
  it('bounds volume work and reduces it without allocating new buffers',()=>{
    expect(['low','auto','medium','high'].map(q=>fogSampleBudget(q as 'low'|'auto'|'medium'|'high'))).toEqual([2,4,4,6]);
    const fog=createPlayerFog('high',false,createCastleLanterns(false).lights);
    const player=fog.uniforms.uFogPlayer.value;
    fog.setLow();fog.update(20,1,2,3);
    expect(fog.diagnostics).toMatchObject({samples:2,animated:false});
    expect(fog.uniforms.uFogPlayer.value).toBe(player);
  });
  it('batches stars, galaxy washes and constellation threads into three draws',()=>{
    const fog=createPlayerFog('medium',false,createCastleLanterns(false).lights);
    const sky=createCastleNightSky('medium',false,fog);
    expect(sky.group.children).toHaveLength(3);
    expect(sky.diagnostics).toMatchObject({draws:3,galaxies:2,constellations:3});
    const stars=sky.group.children[1] as THREE.Points;
    const position=stars.geometry.attributes.position as THREE.BufferAttribute;
    const version=position.version;
    sky.update(1,1,new THREE.Vector3(0,5,8));
    sky.update(2,1.5,new THREE.Vector3(40,10,50));
    expect(position.version).toBe(version);
    expect(sky.group.position.toArray()).toEqual([40,10,50]);
    expect(sky.group.rotation.toArray().slice(0,3)).toEqual([0,0,0]);
    sky.setLow();expect(sky.diagnostics.stars).toBeLessThan(nightStarBudget('low')+25);
    expect(sky.diagnostics).toMatchObject({constellations:3,galaxies:2,animated:false});
  });
});
