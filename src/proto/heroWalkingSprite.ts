import measurements from './art/heroWalkingLayout.json';
import { HERO_OVERHEAD_LENGTH_SCALE, type AtlasRect } from './directionalSprites';
import { createQuadrupedSpriteDefinition, type QuadrupedLayout } from './quadrupedSprite';

// One coherent full-body cutout per view/phase; existing head/torso/hind joints
// articulate it. Equal phase rectangles retain pixel scale and foot registration.
const layouts: readonly QuadrupedLayout[] = [
  {kind:'stacked',neck:[[0,.40],[.25,.47],[.5,.56],[.75,.47],[1,.40]],hip:[[0,.75],[.5,.75],[1,.75]],pivots:[[.5,.59],[.5,.43],[.5,.25]]},
  {kind:'side',neck:[[.55,0],[.53,.30],[.45,.50],[.30,.69],[0,.65]],hip:[[.69,0],[.68,.42],[.70,.75],[.72,1]],pivots:[[.36,.55],[.48,.44],[.69,.29]]},
  {kind:'side',neck:[[.40,0],[.41,.30],[.32,.54],[.25,.70],[0,.70]],hip:[[.69,0],[.68,.40],[.73,.75],[.78,1]],pivots:[[.28,.55],[.50,.5],[.70,.37]]},
  {kind:'side',neck:[[.43,0],[.42,.22],[.33,.40],[.20,.53],[0,.48]],hip:[[.64,0],[.61,.39],[.63,.70],[.64,1]],pivots:[[.30,.66],[.46,.48],[.64,.30]]},
  {kind:'stacked',neck:[[0,.30],[.5,.36],[1,.30]],hip:[[0,.64],[.5,.59],[1,.64]],pivots:[[.5,.67],[.5,.49],[.5,.30]]},
];
const topLayout: QuadrupedLayout = {kind:'stacked',neck:[[0,.29],[.5,.34],[1,.29]],
  hip:[[0,.64],[.5,.59],[1,.64]],pivots:[[.5,.68],[.5,.48],[.5,.28]]};
const frames = Array.from({length:4},(_,phase)=>createQuadrupedSpriteDefinition({
  id:`hero-walking-${phase}`,
  low:measurements.low.rects.map((row,i)=>({source:'heroWalkingLow',rect:row[phase] as unknown as AtlasRect,layout:layouts[i]})),
  high:measurements.high.rects.slice(0,5).map((row,i)=>({source:'heroWalkingHigh',rect:row[phase] as unknown as AtlasRect,layout:layouts[i]})),
  top:{source:'heroWalkingHigh',rect:measurements.high.rects[5][phase] as unknown as AtlasRect,layout:topLayout},
  overheadLengthScale:HERO_OVERHEAD_LENGTH_SCALE,
  // The authored phases supply paw motion; restrained articulation keeps seams closed.
  motion:{headSway:.003,headBob:.001,actionHeadBob:0,actionHeadTilt:0,bodyBreath:.001,bodyStride:0,hindSway:.002,hindStride:0},
}));
// Phase IDs make the same gait observable in every renderer and validation tool.
frames.forEach((definition,phase)=>{
  for(const frame of [...definition.low,...definition.high,definition.top]){
    frame.id+=`-walk-${phase}`;
    // Side silhouettes are wider than front ones. Fit uniformly within the
    // shared standee, with paws anchored at zero rather than trimming the tail.
    const rect=frame.parts[0].rect;
    const height=frame===definition.top?1:Math.min(1,1.25*rect[3]/rect[2]);
    frame.parts=frame.parts.map(part=>({...part,height,y:height/2}));
  }
});
export const HERO_WALKING_DIRECTIONAL_SPRITE = {...frames[0],id:'hero-walking',animation:{frames,fps:6}};
/** One complete paw cycle per half table square, independent of camera/pace. */
export const HERO_WALK_STRIDE = 24;
