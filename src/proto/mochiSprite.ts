import type { AtlasRect } from './directionalSprites';
import measurements from './art/mochiLayout.json';
import { createQuadrupedSpriteDefinition, type QuadrupedLayout, type QuadrupedFrameSpec } from './quadrupedSprite';

// Rectangles and anatomical seams are authored against Mochi's coherent cat
// drawings. The shared renderer never guesses anatomy or inherits Hero's shape.
const atlasRect = (rect: number[]): AtlasRect => [rect[0],rect[1],rect[2],rect[3]];
const lowRects = measurements.low.rects.map(atlasRect);
const front: QuadrupedLayout={kind:'stacked',neck:[[0,.48],[.25,.53],[.5,.57],[.75,.53],[1,.48]],hip:[[0,.73],[.5,.73],[1,.73]],pivots:[[.5,.47],[.5,.38],[.5,.27]]};
const quarter: QuadrupedLayout={kind:'side',neck:[[.45,0],[.43,.35],[.32,.55],[.19,.67],[0,.66]],hip:[[.67,0],[.67,.45],[.62,.68],[.57,1]],pivots:[[.3,.48],[.48,.43],[.66,.43]]};
const side: QuadrupedLayout={kind:'side',neck:[[.32,0],[.31,.30],[.25,.50],[.16,.68],[0,.70]],hip:[[.68,0],[.67,.40],[.64,.66],[.59,1]],pivots:[[.23,.47],[.47,.45],[.66,.44]]};
const rearQuarter: QuadrupedLayout={kind:'side',neck:[[.40,0],[.35,.24],[.25,.40],[.10,.50],[0,.48]],hip:[[.62,0],[.62,.40],[.60,.68],[.54,1]],pivots:[[.28,.65],[.48,.49],[.61,.45]]};
const rear: QuadrupedLayout={kind:'stacked',neck:[[0,.27],[.5,.32],[1,.27]],hip:[[0,.51],[.5,.56],[1,.51]],pivots:[[.5,.70],[.5,.53],[.5,.43]]};
const layouts=[front,quarter,side,rearQuarter,rear,{...rearQuarter,mirrored:true},{...side,mirrored:true},{...quarter,mirrored:true}];
const low: QuadrupedFrameSpec[]=lowRects.map((rect,i)=>({source:'mochiLow',rect,layout:layouts[i]}));
const highRects = measurements.high.rects.slice(0,8).map(atlasRect);
const highQuarter: QuadrupedLayout={kind:'side',neck:[[.48,0],[.46,.40],[.40,.61],[.18,.86],[0,.84]],hip:[[.68,0],[.68,.42],[.64,.68],[.57,1]],pivots:[[.34,.38],[.50,.45],[.66,.53]]};
const highSide: QuadrupedLayout={...side,neck:[[.35,0],[.34,.30],[.28,.55],[.16,.78],[0,.76]],pivots:[[.25,.41],[.48,.46],[.66,.48]]};
const highLayouts=[{...front,inverted:true},highQuarter,highSide,rearQuarter,rear,{...rearQuarter,mirrored:true},{...highSide,mirrored:true},{...highQuarter,mirrored:true}];
// The v2 sheets have separate silhouettes and clear gutters; every crop keeps
// the complete cat without the old atlas's overlapping-row corner guards.
const high: QuadrupedFrameSpec[]=highRects.map((rect,i)=>({source:'mochiHigh',rect,layout:highLayouts[i]}));

export const MOCHI_DIRECTIONAL_SPRITE=createQuadrupedSpriteDefinition({
  id:'mochi',low,high,
  top:{source:'mochiHigh',rect:atlasRect(measurements.high.rects[8]),layout:{kind:'stacked',neck:[[0,.21],[.5,.23],[1,.21]],hip:[[0,.61],[.5,.60],[1,.61]],pivots:[[.5,.78],[.5,.62],[.5,.39]]}},
  motion:{breathFrequency:2.4,headBob:.002,headSway:.009,bodyBreath:.004,hindFrequency:2.7,hindSway:.008},
});
