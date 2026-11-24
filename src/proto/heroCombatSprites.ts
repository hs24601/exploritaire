import measurements from './art/heroCombatLayout.json';
import type { AtlasRect, DirectionalSpriteDefinition } from './directionalSprites';
import { createQuadrupedSpriteDefinition, type QuadrupedLayout } from './quadrupedSprite';

// Reactions keep the shared hierarchy but remain a single still silhouette:
// the arena supplies impact motion; a collapsed body must never idle or stride.
const layout: QuadrupedLayout = {kind: 'stacked', neck: [[0,.33],[1,.33]],
  hip: [[0,.67],[1,.67]], pivots: [[.5,.67],[.5,.5],[.5,.33]]};
const makePose = (pose: 'flinch' | 'down'): DirectionalSpriteDefinition => {
  const rects = measurements[pose].rects;
  const source = pose === 'flinch' ? 'heroFlinch' : 'heroDown';
  const frame = (index: number) => ({source, rect: rects[index] as unknown as AtlasRect, layout});
  const definition = createQuadrupedSpriteDefinition({id: `hero-${pose}`,
    low: [0,1,2,3,4].map(frame), high: [5,1,6,3,7].map(frame), top: frame(8)});
  // Scale by source pixels across views, retaining the shorter flinch/down body
  // instead of stretching every pose to standing height. Overhead is a footprint.
  const pixelHeight = pose === 'flinch' ? rects[0][3] / .85 : rects[2][2] / 1.3;
  for (const view of [...definition.low, ...definition.high, definition.top]) {
    view.parts = view.parts.map(part => ({...part,
      height: view === definition.top ? 1 : part.rect[3] / pixelHeight,
      y: view === definition.top ? .5 : part.rect[3] / pixelHeight / 2}));
  }
  definition.motionProfile = {...definition.motionProfile!, headBob:0, headSway:0,
    actionHeadBob:0, actionHeadTilt:0, bodyBreath:0, bodyStride:0, hindSway:0, hindStride:0};
  return definition;
};

export const HERO_COMBAT_POSES = {flinch: makePose('flinch'), down: makePose('down')};
