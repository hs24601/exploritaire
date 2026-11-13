import { expect, it } from 'vitest';
import { PerspectiveCamera, Texture } from 'three';
import { DEM_DIRECTIONAL_SPRITE, DEM_SPRITE_ASSETS } from './demSprite';
import { DEM_COMBAT_ASSETS, DEM_COMBAT_POSES, DEM_REACTION_DURATION, sampleDemReaction } from './demCombatSprites';
import measurements from './art/demCombatLayout.json';
import { createDirectionalSpriteLibrary } from './directionalSpriteRig';

it('switches all attack/recoil views on the existing bear hierarchy and returns to standing',()=>{
  const textures=Object.fromEntries(Object.keys({...DEM_SPRITE_ASSETS,...DEM_COMBAT_ASSETS}).map(key=>{
    const texture=new Texture();texture.image={width:key==='demLow'||key==='demHigh'?1536:2048,height:key==='demLow'||key==='demHigh'?1024:1536};texture.userData.watercolor=true;return [key,texture];
  }));
  const library=createDirectionalSpriteLibrary(textures,DEM_DIRECTIONAL_SPRITE,DEM_COMBAT_POSES),rig=library.create(1.7),camera=new PerspectiveCamera();
  const joints=rig.parts.map(part=>part.pivot);
  for(const pose of ['hit','flinch'] as const) {
    rig.setPose(pose);
    for(const [elevation,tier] of [[.2,'low'],[1,'high']] as const)for(let direction=0;direction<5;direction++) {
      const yaw=direction*Math.PI/4;camera.position.set(Math.sin(yaw)*5,Math.tan(elevation)*5,Math.cos(yaw)*5);rig.update(camera,0,.2,true);
      expect(rig.frame).toBe(DEM_COMBAT_POSES[pose][tier][direction].id);
      expect(rig.parts.map(p=>p.pivot)).toEqual(joints);
      for(const part of rig.parts)expect(part.material.map).toBe(textures[pose==='hit'?'demHit':'demFlinch']);
    }
    camera.position.set(0,20,.001);rig.update(camera,0,0,true);expect(rig.frame).toBe('top');
    for(const frame of [...DEM_COMBAT_POSES[pose].low,...DEM_COMBAT_POSES[pose].high,DEM_COMBAT_POSES[pose].top])for(const part of frame.parts){
      const [x,y,w,h]=part.rect;expect(x+w).toBeLessThanOrEqual(measurements[pose].size[0]);expect(y+h).toBeLessThanOrEqual(measurements[pose].size[1]);expect(part.height).toBeGreaterThan(0);
    }
    rig.setPose('standing');rig.update(camera,0,0,true);expect(rig.parts[0].material.map).toBe(textures.demHigh);
  }
  rig.dispose();library.dispose();Object.values(textures).forEach(t=>t.dispose());
});

it('plays one wind-up/contact/recovery or recoil and resets every transform at completion',()=>{
  expect(sampleDemReaction('hit',.08)).toMatchObject({pose:'standing',done:false});
  expect(sampleDemReaction('hit',.3)).toMatchObject({pose:'hit',done:false});
  expect(sampleDemReaction('hit',.3).forward).toBeGreaterThan(0);
  expect(sampleDemReaction('hit',.6).pose).toBe('standing');
  expect(sampleDemReaction('flinch',.1).pose).toBe('flinch');
  expect(sampleDemReaction('flinch',.1).forward).toBeLessThan(0);
  for(const kind of ['hit','flinch'] as const){
    for(const elapsed of [DEM_REACTION_DURATION[kind],20])expect(sampleDemReaction(kind,elapsed)).toEqual({pose:'standing',forward:0,flash:0,done:true});
    for(const elapsed of [0,.1,.25])expect(sampleDemReaction(kind,elapsed,true)).toEqual({pose:kind,forward:0,flash:0,done:false});
  }
});
