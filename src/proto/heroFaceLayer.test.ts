import { expect, it } from 'vitest';
import { PerspectiveCamera, Texture } from 'three';
import { attachedFaceGeometry, createDirectionalSpriteLibrary } from './directionalSpriteRig';
import { HERO_SITTING_DIRECTIONAL_SPRITE } from './heroSittingSprite';
import measurements from './art/heroSittingLayout.json';
import { HERO_DIRECTIONAL_SPRITE } from './directionalSprites';
import { HERO_WALKING_DIRECTIONAL_SPRITE } from './heroWalkingSprite';
import { heroFaceAttachment } from './heroFaceAttachments';
it('registers the body silhouette mask to every face patch vertex and gait phase', () => {
  for (const phase of HERO_WALKING_DIRECTIONAL_SPRITE.animation!.frames) {
    for (const tier of ['low','high'] as const) for (const frame of phase[tier].slice(0,4)) {
      const part=frame.parts[0], attachment=heroFaceAttachment(frame)!;
      const image={width:2048,height:4096};
      const geometry=attachedFaceGeometry(part,attachment,image,image);
      const positions=geometry.getAttribute('position'), mask=geometry.getAttribute('faceBodyUv');
      expect(positions.count).toBeGreaterThan(0);
      for(let i=0;i<positions.count;i++) {
        const x=positions.getX(i)+.5, y=.5-positions.getY(i);
        expect(mask.getX(i)).toBeCloseTo((part.rect[0]+x*part.rect[2])/image.width,6);
        expect(mask.getY(i)).toBeCloseTo(1-(part.rect[1]+y*part.rect[3])/image.height,6);
      }
      geometry.dispose();
    }
  }
});
it('registers reused expressions for standing views and every walking phase without touching bodies', () => {
  for (const definition of [HERO_DIRECTIONAL_SPRITE, ...HERO_WALKING_DIRECTIONAL_SPRITE.animation!.frames]) {
    for (const tier of ['low', 'high'] as const) {
      for (let direction=0;direction<4;direction++) {
        const frame = definition[tier][direction];
        const before = JSON.stringify(frame);
        const attachment = heroFaceAttachment(frame)!;
        expect(attachment.source).toMatch(/^heroSitting(Low|High)SadFace$/);
        expect(attachment.rect[2]).toBeGreaterThan(0);
        expect(attachment.target[2]).toBeGreaterThan(0);
        expect(JSON.stringify(frame)).toBe(before);
      }
      expect(heroFaceAttachment(definition[tier][4])).toBeUndefined();
    }
    expect(heroFaceAttachment(definition.top)).toBeUndefined();
  }
});
it('registers sad faces to the head while preserving pose geometry and hiding unseen faces', () => {
  const textures: Record<string, Texture> = {};
  for (const tier of ['low', 'high'] as const) for (const suffix of ['', 'SadFace']) {
    const t = new Texture(); t.image = measurements[tier]; t.userData.watercolor = true;
    textures[`heroSitting${tier === 'low' ? 'Low' : 'High'}${suffix}`] = t;
  }
  const library = createDirectionalSpriteLibrary(textures, HERO_SITTING_DIRECTIONAL_SPRITE);
  const actor = library.create(1), camera = new PerspectiveCamera(); camera.position.set(0,.2,10);
  actor.update(camera,0,0,true);
  const head = actor.parts[0], originalGeometry = head.mesh.geometry;
  expect(actor.faceLayer!.visible).toBe(false);
  actor.setExpression('sad'); actor.update(camera,0,1,true);
  expect(actor.faceLayer!.visible).toBe(true);
  expect(actor.faceLayer!.parent).toBe(head.pivot);
  expect(actor.faceLayer!.scale.equals(head.mesh.scale)).toBe(true);
  expect(head.mesh.geometry).toBe(originalGeometry);
  expect(actor.faceLayer!.material.map).toBe(textures.heroSittingLowSadFace);
  actor.setOpacity(.4); expect(actor.faceLayer!.material.opacity).toBe(.4);
  camera.position.set(0,10,.2); actor.update(camera,0,2,true);
  expect(actor.faceLayer!.visible).toBe(false);
  camera.position.set(0,.2,-10); actor.update(camera,0,3,true);
  expect(actor.faceLayer!.visible).toBe(false);
  camera.position.set(0,.2,10); actor.setExpression('happy'); actor.update(camera,0,4,true);
  expect(actor.faceLayer!.visible).toBe(false);
  actor.dispose(); library.dispose(); Object.values(textures).forEach(t => t.dispose());
});
