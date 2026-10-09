import { expect, it } from 'vitest';
import { actorHeading, billboardFacing, movementHeading, worldActorTransform, type OrientedActor } from './actorOrientation';
import { HERO_SPRITE_RIG, sampleSpritePose } from './actorSpriteLibrary';

const party: OrientedActor = { id: 'hero', team: 'party', position: { x: -3, z: 0 } };
const wolf: OrientedActor = { id: 'wolf', team: 'enemy', position: { x: 3, z: 0 } };

it('keeps table facing across stationary pose changes and permits authored rest headings', () => {
  const heading = movementHeading({ x: 48, y: 0 }, { x: 0, y: 0, heading: 0 });
  expect(heading).toBe(Math.PI / 2);
  expect(movementHeading({ x: 48, y: 0 }, { x: 48, y: 0, heading })).toBe(heading);
  expect(movementHeading({ x: 48, y: 0 }, { x: 48, y: 0, heading }, 0)).toBe(0);
  for (const upright of [false, true]) expect(worldActorTransform(heading, upright)).not.toContain('camera');
});

it('faces the live opposing centre, including during movement and after crossing sides', () => {
  const actors = [party, wolf, { ...wolf, id: 'rear', position: { x: 5, z: -2 } }];
  expect(actorHeading(party, actors)).toBeCloseTo(Math.atan2(7, -1));
  expect(actorHeading(wolf, actors)).toBeCloseTo(-Math.PI / 2);
  expect(actorHeading({ ...party, position: { x: 7, z: 0 } }, actors)).toBeCloseTo(Math.atan2(-3, -1));
});

it('supports ambush headings, focus targets, fallback, and coincident or absent opponents', () => {
  expect(actorHeading({ ...party, facing: { kind: 'fixed', yaw: .4 } }, [party, wolf])).toBe(.4);
  expect(actorHeading({ ...party, facing: { kind: 'point', point: { x: -3, z: -2 } } }, [party, wolf])).toBe(Math.PI);
  expect(actorHeading({ ...party, facing: { kind: 'target', actorId: 'wolf' } }, [party, wolf])).toBeCloseTo(Math.PI / 2);
  expect(actorHeading({ ...party, facing: { kind: 'target', actorId: 'missing' } }, [party, wolf])).toBeCloseTo(Math.PI / 2);
  expect(actorHeading(party, [party], .7)).toBe(.7);
  expect(actorHeading(party, [party, { ...wolf, position: party.position }], .8)).toBe(.8);
});

it('projects both teams toward each other throughout a full camera orbit for either authored facing', () => {
  for (const authored of ['left', 'right'] as const) {
    let heroFlip = 1, wolfFlip = 1;
    for (let i = 0; i <= 720; i++) {
      const cameraYaw = i * Math.PI / 360;
      heroFlip = billboardFacing(Math.PI / 2, cameraYaw, authored, heroFlip);
      wolfFlip = billboardFacing(-Math.PI / 2, cameraYaw, authored, wolfFlip);
      const projection = Math.cos(cameraYaw);
      if (Math.abs(projection) >= .035) {
        expect(heroFlip * (authored === 'left' ? -1 : 1) * projection).toBeGreaterThan(0);
        expect(wolfFlip).toBe(-heroFlip);
      }
    }
  }
  expect(billboardFacing(Math.PI / 2, Math.PI / 2, 'left', -1)).toBe(-1);
});

it('shares three distinct joints and coordinated motion, with an exact neutral reduced-motion pose', () => {
  expect(HERO_SPRITE_RIG.parts.map(part => part.id)).toEqual(['hind', 'torso', 'head']);
  const poses = HERO_SPRITE_RIG.parts.map(part => sampleSpritePose(part.id, 4.1, 0, 1));
  expect(new Set(poses.map(pose => JSON.stringify(pose))).size).toBe(3);
  for (const part of HERO_SPRITE_RIG.parts) {
    expect(sampleSpritePose(part.id, 4.1, 0, 1, true)).toEqual({ x: 0, y: 0, angle: 0, scaleY: 1 });
  }
});
