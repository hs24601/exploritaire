import { expect, it } from 'vitest';
import { PerspectiveCamera, Texture } from 'three';
import { DEM_DIRECTIONAL_SPRITE, DEM_SPRITE_ASSETS } from './demSprite';
import { createDirectionalSpriteLibrary } from './directionalSpriteRig';
import measurements from './art/demStandingLayout.json';

it('registers every standing frame inside its Dem atlas with independent bear joints', () => {
  const sizes: Record<string,number[]> = {demLow:measurements.low.size,demHigh:measurements.high.size};
  for (const frame of [...DEM_DIRECTIONAL_SPRITE.low, ...DEM_DIRECTIONAL_SPRITE.high, DEM_DIRECTIONAL_SPRITE.top]) {
    const [width,height] = sizes[frame.source];
    expect(frame.parts.map(p => p.id)).toEqual(['head','torso','hind']);
    expect(frame.parts.map(p => p.parent)).toEqual(['torso',undefined,'torso']);
    for (const part of frame.parts) {
      const [x,y,w,h] = part.rect;
      expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
      expect(w).toBeGreaterThan(0); expect(h).toBeGreaterThan(0);
      expect(x+w).toBeLessThanOrEqual(width); expect(y+h).toBeLessThanOrEqual(height);
      expect(part.rect).toEqual(frame.parts[0].rect);
      expect(part.clip!.every(point => point.every(n => n>=0 && n<=1))).toBe(true);
    }
  }
});

it('renders the complete low/high orbit and a world-aligned overhead footprint through the shared rig', () => {
  const textures = Object.fromEntries(Object.keys(DEM_SPRITE_ASSETS).map(key => {
    const texture = new Texture(); texture.image = {width:1536,height:1024};
    texture.userData.watercolor = true; return [key,texture];
  }));
  const library = createDirectionalSpriteLibrary(textures, DEM_DIRECTIONAL_SPRITE);
  const rig = library.create(1.7), camera = new PerspectiveCamera();
  for (const [elevation,tier] of [[.2,'low'],[1,'high']] as const) {
    for (let direction=0;direction<5;direction++) for (const sign of [-1,1]) {
      const yaw=direction*Math.PI/4*sign;
      camera.position.set(Math.sin(yaw)*5,Math.tan(elevation)*5,Math.cos(yaw)*5);
      rig.update(camera,0,0,true);
      expect(rig.view).toMatchObject({direction,elevation:tier});
      expect(rig.frame).toBe(DEM_DIRECTIONAL_SPRITE[tier][direction].id);
      for (const joint of rig.parts) expect(joint.material.map).toBe(textures[tier==='low'?'demLow':'demHigh']);
    }
  }
  camera.position.set(0,20,.001);
  for (const heading of [0,1,Math.PI]) {
    rig.update(camera,heading,0,true);
    expect(rig.frame).toBe('top'); expect(rig.facing.scale.x).toBe(1);
    expect(rig.billboard.rotation.y).toBeCloseTo(heading+Math.PI);
  }
  rig.dispose(); library.dispose(); Object.values(textures).forEach(t=>t.dispose());
});
