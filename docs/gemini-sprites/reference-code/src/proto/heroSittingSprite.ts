import measurements from './art/heroSittingLayout.json';
import type { AtlasRect } from './directionalSprites';
import { createQuadrupedSpriteDefinition, type QuadrupedLayout } from './quadrupedSprite';

// Sitting anatomy stays on one coherent registration grid in every direction.
// The generated references contain no detached pieces; joints only clip source UVs.
const front: QuadrupedLayout = { kind: 'stacked', neck: [[0,.43],[.25,.48],[.5,.55],[.75,.48],[1,.43]],
  hip: [[0,.76],[.5,.76],[1,.76]], pivots: [[.5,.58],[.5,.42],[.5,.23]] };
const quarter: QuadrupedLayout = { kind: 'side', neck: [[.56,0],[.55,.30],[.48,.47],[.31,.62],[0,.58]],
  hip: [[.69,0],[.67,.45],[.61,.72],[.58,1]], pivots: [[.38,.55],[.48,.39],[.68,.24]] };
const side: QuadrupedLayout = { kind: 'side', neck: [[.54,0],[.52,.30],[.43,.48],[.27,.63],[0,.61]],
  hip: [[.68,0],[.67,.43],[.61,.68],[.56,1]], pivots: [[.34,.56],[.46,.40],[.67,.24]] };
const rearQuarter: QuadrupedLayout = { kind: 'side', neck: [[.47,0],[.45,.20],[.35,.34],[.20,.43],[0,.40]],
  hip: [[.62,0],[.60,.39],[.56,.70],[.49,1]], pivots: [[.31,.65],[.45,.43],[.65,.23]] };
const rear: QuadrupedLayout = { kind: 'stacked', neck: [[0,.30],[.5,.40],[1,.30]],
  hip: [[0,.66],[.5,.62],[1,.66]], pivots: [[.5,.67],[.5,.46],[.5,.24]] };
const layouts = [front, quarter, side, rearQuarter, rear,
  {...rearQuarter, mirrored:true}, {...side, mirrored:true}, {...quarter, mirrored:true}];
const atlasRect = ([x,y,width,height]: readonly number[]): AtlasRect => [x,y,width,height];
const frames = (tier: 'low' | 'high') => measurements[tier].rects.slice(0,8).map((rect,i) => ({
  source: tier === 'low' ? 'heroSittingLow' : 'heroSittingHigh', rect: atlasRect(rect), layout: layouts[i],
}));
export const HERO_SITTING_DIRECTIONAL_SPRITE = createQuadrupedSpriteDefinition({
  id: 'hero-sitting', low: frames('low'), high: frames('high'),
  top: { source:'heroSittingHigh', rect: atlasRect(measurements.high.rects[8]),
    layout: { kind:'stacked', neck:[[0,.33],[.5,.38],[1,.33]], hip:[[0,.65],[.5,.61],[1,.65]],
      pivots:[[.5,.68],[.5,.48],[.5,.27]] } },
  motion: { headSway:.008, headBob:.002, hindSway:.003, bodyBreath:.004 },
});
