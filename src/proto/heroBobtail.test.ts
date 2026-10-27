import { expect, it } from 'vitest';
import * as THREE from 'three';
import { createDirectionalSpriteLibrary } from './directionalSpriteRig';
import { HERO_DIRECTIONAL_SPRITE } from './directionalSprites';
import { HERO_SITTING_DIRECTIONAL_SPRITE } from './heroSittingSprite';
import { HERO_WALKING_DIRECTIONAL_SPRITE } from './heroWalkingSprite';
import { HERO_COMBAT_POSES } from './heroCombatSprites';
import { getHeroBobtail, setHeroBobtail } from './heroBobtail';

it('defaults on and keeps body, gait, lighting and source registration independent of bobtail visibility', () => {
  expect(getHeroBobtail()).toBe(true);
  const keys=['heroLow','heroHigh','heroSittingLow','heroSittingHigh','heroWalkingLow','heroWalkingHigh','heroFlinch','heroDown'];
  const textures=Object.fromEntries([...keys,...keys.map(key=>key+'Bobtail'),'heroFlameTail'].map(key=>{
    const texture=new THREE.Texture({width:2048,height:2048} as never);texture.userData.watercolor=true;texture.name=key;return [key,texture];
  }));
  const library=createDirectionalSpriteLibrary(textures,HERO_DIRECTIONAL_SPRITE,{sitting:HERO_SITTING_DIRECTIONAL_SPRITE,walking:HERO_WALKING_DIRECTIONAL_SPRITE,...HERO_COMBAT_POSES});
  const actor=library.create(2),camera=new THREE.PerspectiveCamera();
  expect(actor.bobtail?.parent?.name).toBe('hind');
  for(const pose of ['standing','sitting','walking','flinch','down'])for(const elevation of [.2,1,Math.PI/2])for(let heading=0;heading<8;heading++) {
    camera.position.set(0,Math.sin(elevation)*100,Math.cos(elevation)*100);actor.setPose(pose);
    setHeroBobtail(true);actor.update(camera,heading*Math.PI/4,.2,true);
    const body=actor.parts.map(part=>[...part.pivot.position.toArray(),...part.pivot.rotation.toArray(),...part.pivot.scale.toArray()]);
    expect(actor.bobtail?.visible).toBe(true);
    const hind=actor.parts.find(part=>part.part.id==='hind')!;
    expect(actor.bobtail?.material.map?.name).toBe(hind.material.map!.name+'Bobtail');
    expect(actor.bobtail?.scale.toArray()).toEqual(hind.mesh.scale.toArray());
    setHeroBobtail(false);actor.update(camera,heading*Math.PI/4,.2,true);
    expect(actor.bobtail?.visible).toBe(false);
    expect(actor.parts.map(part=>[...part.pivot.position.toArray(),...part.pivot.rotation.toArray(),...part.pivot.scale.toArray()])).toEqual(body);
    expect(actor.flameTail).toBeUndefined();
  }
  actor.setBobtailVisible(true);actor.update(camera,0,.4,false);expect(actor.bobtail?.visible).toBe(true);
  actor.setOpacity(.25);expect(actor.bobtail?.material.opacity).toBe(.25);
  actor.setBobtailVisible(undefined);actor.update(camera,0,.4,false);expect(actor.bobtail?.visible).toBe(false);
  setHeroBobtail(true);actor.dispose();library.dispose();Object.values(textures).forEach(texture=>texture.dispose());
});
