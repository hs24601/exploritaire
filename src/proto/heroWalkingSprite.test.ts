import {expect,it} from 'vitest';
import {PerspectiveCamera,Texture} from 'three';
import {HERO_DIRECTIONAL_SPRITE} from './directionalSprites';
import {HERO_SITTING_DIRECTIONAL_SPRITE} from './heroSittingSprite';
import {HERO_WALKING_DIRECTIONAL_SPRITE} from './heroWalkingSprite';
import {createDirectionalSpriteLibrary} from './directionalSpriteRig';
import walking from './art/heroWalkingLayout.json';
import sitting from './art/heroSittingLayout.json';

it('cycles paws through every heading/elevation without reallocating joints or changing phase pixel scale',()=>{
  const textures:Record<string,Texture>={};
  for(const [key,width,height] of [['heroLow',1122,1402],['heroHigh',1024,1536],
    ['heroSittingLow',sitting.low.width,sitting.low.height],['heroSittingHigh',sitting.high.width,sitting.high.height],
    ['heroWalkingLow',walking.low.width,walking.low.height],['heroWalkingHigh',walking.high.width,walking.high.height]] as const){
    const texture=new Texture();texture.image={width,height};textures[key]=texture;
  }
  const library=createDirectionalSpriteLibrary(textures,HERO_DIRECTIONAL_SPRITE,{walking:HERO_WALKING_DIRECTIONAL_SPRITE,sitting:HERO_SITTING_DIRECTIONAL_SPRITE});
  const actor=library.create(2),other=library.create(2),camera=new PerspectiveCamera();
  const joints=actor.parts.map(p=>p.pivot),materials=actor.parts.map(p=>p.material);
  actor.setPose('walking');actor.setOpacity(.24);
  for(const elevation of [.2,1,Math.PI/2])for(let direction=0;direction<8;direction++){
    camera.position.set(0,Math.sin(elevation)*100,Math.cos(elevation)*100);
    let size: number[]|undefined;
    for(let phase=0;phase<4;phase++){
      actor.update(camera,-direction*Math.PI/4,(phase+.1)/6,false);
      expect(actor.animationFrame).toBe(phase);expect(actor.frame).toContain(`walk-${phase}`);
      const dimensions=actor.parts[0].part.rect.slice(2);
      if(size)expect(dimensions).toEqual(size);size=dimensions;
      expect(actor.parts.map(p=>p.pivot)).toEqual(joints);expect(actor.parts.map(p=>p.material)).toEqual(materials);
      expect(actor.parts.every(p=>p.material.opacity===.24)).toBe(true);
      expect(actor.facing.scale.y).toBe(elevation>1.2?1.25:1);
      expect(other.pose).toBe('standing');
    }
    actor.update(camera,0,9,true);expect(actor.animationFrame).toBe(0);
    const geometry=actor.parts[0].mesh.geometry;
    actor.update(camera,0,19,true);expect(actor.parts[0].mesh.geometry).toBe(geometry);
  }
  actor.setPose('sitting');actor.update(camera,0,1,true);expect(actor.animationFrame).toBe(0);expect(actor.frame).not.toContain('walk');
  camera.position.set(0,2,12);actor.update(camera,0,1,true);expect(actor.facing.scale.y).toBe(1);
  actor.dispose();other.dispose();library.dispose();Object.values(textures).forEach(t=>t.dispose());
});
