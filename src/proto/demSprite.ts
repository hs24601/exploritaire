import type { AtlasRect } from './directionalSprites';
import { createQuadrupedSpriteDefinition, type QuadrupedLayout } from './quadrupedSprite';
import measurements from './art/demStandingLayout.json';

export const DEM_SPRITE_ASSETS: Readonly<Record<string, string>> = {
  demLow: 'runtime/kin/dem/sprites/combat/refined-low-standing/dem-standing-low-v2.png',
  demHigh: 'runtime/kin/dem/sprites/combat/standing-and-reactions/dem-standing-high-v1.png',
};

// Register Dem's bear anatomy independently of the dog/cat layouts. Each frame
// keeps one coherent painting shared by the head, torso and hind joints.
const front: QuadrupedLayout = { kind: 'stacked', neck: [[0,.46],[.5,.53],[1,.46]], hip: [[0,.72],[.5,.7],[1,.72]], pivots: [[.5,.53],[.5,.4],[.5,.25]] };
const quarter: QuadrupedLayout = { kind: 'side', neck: [[.47,0],[.45,.3],[.36,.52],[.23,.67],[0,.65]], hip: [[.72,0],[.7,.4],[.68,.7],[.62,1]], pivots: [[.31,.53],[.5,.43],[.7,.36]] };
const side: QuadrupedLayout = { kind: 'side', neck: [[.34,0],[.32,.3],[.25,.5],[.17,.68],[0,.68]], hip: [[.74,0],[.73,.4],[.69,.7],[.64,1]], pivots: [[.24,.55],[.5,.43],[.71,.35]] };
const rearQuarter: QuadrupedLayout = { kind: 'side', neck: [[.4,0],[.33,.24],[.25,.4],[.1,.5],[0,.48]], hip: [[.64,0],[.63,.4],[.6,.7],[.55,1]], pivots: [[.27,.65],[.5,.46],[.63,.35]] };
const rear: QuadrupedLayout = { kind: 'stacked', neck: [[0,.26],[.5,.3],[1,.26]], hip: [[0,.52],[.5,.55],[1,.52]], pivots: [[.5,.72],[.5,.49],[.5,.35]] };
const layouts = [front, quarter, side, rearQuarter, rear];
const highLayouts = [{ ...front, neck: [[0,.6],[.5,.66],[1,.6]] as const }, quarter, side, rearQuarter, rear];
const rect = (value: number[]): AtlasRect => [value[0], value[1], value[2], value[3]];

/** Standing presentation only; Dem's proposed combat kit remains separate. */
export const DEM_DIRECTIONAL_SPRITE = createQuadrupedSpriteDefinition({
  id: 'dem',
  low: measurements.low.rects.map((value, i) => ({ source: 'demLow', rect: rect(value), layout: layouts[i] })),
  high: measurements.high.rects.slice(0,5).map((value, i) => ({ source: 'demHigh', rect: rect(value), layout: highLayouts[i] })),
  top: { source: 'demHigh', rect: rect(measurements.high.rects[5]), layout: { kind: 'stacked', neck: [[0,.3],[.5,.34],[1,.3]], hip: [[0,.69],[.5,.67],[1,.69]], pivots: [[.5,.7],[.5,.5],[.5,.28]] } },
  motion: { breathFrequency: 1.8, headBob: .0015, headSway: .005, bodyBreath: .003, hindFrequency: 2, hindSway: .004 },
});
