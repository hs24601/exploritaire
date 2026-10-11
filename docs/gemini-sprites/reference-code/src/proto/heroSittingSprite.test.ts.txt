import { expect, it } from 'vitest';
import { PerspectiveCamera, Texture } from 'three';
import { HERO_DIRECTIONAL_SPRITE } from './directionalSprites';
import { HERO_SITTING_DIRECTIONAL_SPRITE } from './heroSittingSprite';
import { createDirectionalSpriteLibrary } from './directionalSpriteRig';
import measurements from './art/heroSittingLayout.json';

it('switches sitting/standing on existing joints through every direction and elevation', () => {
  const textures: Record<string, Texture> = {};
  for (const [key, width, height] of [
    ['heroLow',1122,1402], ['heroHigh',1024,1536],
    ['heroSittingLow',measurements.low.width,measurements.low.height],
    ['heroSittingHigh',measurements.high.width,measurements.high.height],
  ] as const) { const t = new Texture(); t.image = {width,height}; textures[key] = t; }
  const library = createDirectionalSpriteLibrary(textures,HERO_DIRECTIONAL_SPRITE,{sitting:HERO_SITTING_DIRECTIONAL_SPRITE});
  const actor = library.create(2), other = library.create(2), camera = new PerspectiveCamera();
  const joints = actor.parts.map(part => part.pivot), materials = actor.parts.map(part => part.material);
  actor.setOpacity(.24);
  for (const elevation of [.2,1,Math.PI/2]) for (let direction=0;direction<8;direction++) {
    const heading=-direction*Math.PI/4;
    camera.position.set(0,Math.sin(elevation)*100,Math.cos(elevation)*100);
    actor.setPose('standing'); actor.update(camera,heading,0,true);
    const view = {...actor.view};
    const standingTexture = actor.parts[0].material.map;
    actor.setPose('sitting'); actor.update(camera,heading,0,true);
    expect(actor.pose).toBe('sitting'); expect(actor.view).toEqual(view);
    expect(actor.parts[0].material.map).toBe(elevation>1.2||elevation>.7?textures.heroSittingHigh:textures.heroSittingLow);
    expect(actor.parts.map(part=>part.pivot)).toEqual(joints);
    expect(actor.parts.map(part=>part.material)).toEqual(materials);
    expect(actor.parts.every(part=>part.material.opacity===.24)).toBe(true);
    expect(other.pose).toBe('standing');
    actor.setPose('standing');actor.update(camera,heading,0,true);
    expect(actor.parts[0].material.map).toBe(standingTexture);
  }
  expect(()=>actor.setPose('unknown')).toThrow('Unknown sprite pose');
  actor.dispose();other.dispose();library.dispose();Object.values(textures).forEach(texture=>texture.dispose());
});
