import { expect, it } from 'vitest';
import * as THREE from 'three';
import { createDirectionalSpriteLibrary } from './directionalSpriteRig';
import { HERO_DIRECTIONAL_SPRITE } from './directionalSprites';
import { HERO_SITTING_DIRECTIONAL_SPRITE } from './heroSittingSprite';
import { HERO_WALKING_DIRECTIONAL_SPRITE } from './heroWalkingSprite';
import { HERO_COMBAT_POSES } from './heroCombatSprites';
import { setHeroFlameTail } from './heroFlameTail';

it('keeps flame visibility, motion and the light socket independent of body anatomy across poses', () => {
  const textures=Object.fromEntries(['heroLow','heroHigh','heroSittingLow','heroSittingHigh','heroWalkingLow','heroWalkingHigh','heroFlinch','heroDown','heroFlameTail'].map(key=>{
    const texture=new THREE.Texture({width:2048,height:2048} as never);texture.userData.watercolor=true;return [key,texture];
  }));
  const library=createDirectionalSpriteLibrary(textures,HERO_DIRECTIONAL_SPRITE,{sitting:HERO_SITTING_DIRECTIONAL_SPRITE,walking:HERO_WALKING_DIRECTIONAL_SPRITE,...HERO_COMBAT_POSES},{heroFlameTail:true});
  const actor=library.create(2),camera=new THREE.PerspectiveCamera();camera.position.set(8,5,10);
  const flame=actor.flameTail!;
  expect(flame.root.parent?.name).toBe('hind');expect(flame.pieces).toHaveLength(3);
  for(const pose of ['standing','sitting','walking','flinch','down']) {
    actor.setPose(pose);setHeroFlameTail(true);actor.update(camera,.5,1,true);
    const body=actor.parts.map(joint=>joint.pivot.position.toArray());
    const neutral=flame.pieces.map(piece=>piece.pivot.rotation.z);
    actor.update(camera,.5,5,true);
    expect(flame.pieces.map(piece=>piece.pivot.rotation.z)).toEqual(neutral);
    setHeroFlameTail(false);actor.update(camera,.5,1,true);
    expect(flame.root.visible).toBe(false);expect(flame.intensity).toBe(0);
    expect(actor.parts.map(joint=>joint.pivot.position.toArray())).toEqual(body);
    actor.setFlameTailVisible(true);actor.update(camera,.5,1,false);
    const animated=flame.pieces.map(piece=>piece.pivot.rotation.z);
    actor.update(camera,.5,1.2,false);
    expect(flame.pieces.map(piece=>piece.pivot.rotation.z)).not.toEqual(animated);
    actor.setOpacity(.2);actor.update(camera,.5,2,true);expect(flame.intensity).toBe(.2);
    const socket=flame.socket.getWorldPosition(new THREE.Vector3());actor.root.position.x+=3;
    expect(flame.socket.getWorldPosition(new THREE.Vector3()).x-socket.x).toBeCloseTo(3);
    actor.setFlameTailVisible(undefined);actor.setOpacity(1);
  }
  actor.setPose('walking');actor.setFlameTailVisible(true);
  actor.update(camera,0,0,false,0,0,1);
  const flamesAtRest=flame.pieces.map(piece=>piece.pivot.rotation.z);
  actor.update(camera,0,0,false,0,0,1.2);
  expect(actor.animationFrame).toBe(0);
  expect(flame.pieces.map(piece=>piece.pivot.rotation.z)).not.toEqual(flamesAtRest);
  setHeroFlameTail(true);actor.dispose();library.dispose();Object.values(textures).forEach(texture=>texture.dispose());
});
