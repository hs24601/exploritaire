import { DEM_DIRECTIONAL_SPRITE } from './demSprite';
import type { AtlasRect, DirectionalFrame, DirectionalSpriteDefinition } from './directionalSprites';
import measurements from './art/demCombatLayout.json';

export const DEM_COMBAT_ASSETS: Readonly<Record<string,string>> = {
  demHit: 'runtime/kin/dem/sprites/combat/standing-and-reactions/dem-hit-v1.png',
  demFlinch: 'runtime/kin/dem/sprites/combat/standing-and-reactions/dem-flinch-v1.png',
};
export type DemReaction = 'hit' | 'flinch';

function makePose(pose: DemReaction): DirectionalSpriteDefinition {
  const rects = measurements[pose].rects;
  const frame = (original: DirectionalFrame, index: number): DirectionalFrame => ({
    ...original, source: pose === 'hit' ? 'demHit' : 'demFlinch',
    parts: original.parts.map(part => {
      // Match the standing body's width rather than stretching a crouched bear
      // back to full height. The striking paw may extend beyond that footprint.
      const standingAspect = part.rect[2]/part.rect[3], poseAspect = rects[index][2]/rects[index][3];
      const height = index === 10 ? 1 : Math.max(.6,Math.min(pose==='hit'?1:.9,standingAspect/poseAspect*(pose==='hit'?1.12:1)));
      return {...part, rect: rects[index] as unknown as AtlasRect, height, y: height/2};
    }),
  });
  return {...DEM_DIRECTIONAL_SPRITE, id: `dem-${pose}`,
    low: DEM_DIRECTIONAL_SPRITE.low.map(frame),
    high: DEM_DIRECTIONAL_SPRITE.high.map((view,i)=>frame(view,i+5)),
    top: frame(DEM_DIRECTIONAL_SPRITE.top,10),
    motionProfile: {...DEM_DIRECTIONAL_SPRITE.motionProfile!,headBob:0,headSway:0,actionHeadBob:0,actionHeadTilt:0,bodyBreath:0,bodyStride:0,hindSway:0,hindStride:0},
  };
}
export const DEM_COMBAT_POSES = { hit: makePose('hit'), flinch: makePose('flinch') };
export const DEM_REACTION_DURATION = { hit: .72, flinch: .5 } as const;
const smooth = (t: number) => { const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x); };

/** A one-shot, caller-clocked cue; pausing the caller freezes every phase. */
export function sampleDemReaction(kind: DemReaction, elapsed: number, reduced = false) {
  const duration = DEM_REACTION_DURATION[kind], t = Math.max(0,elapsed);
  if(t>=duration) return {pose:'standing' as const,forward:0,flash:0,done:true};
  if(reduced) return {pose:kind,forward:0,flash:0,done:false};
  if(kind==='flinch') return {
    pose: t<.3 ? 'flinch' as const : 'standing' as const,
    forward: -.1*Math.sin(Math.PI*t/duration), flash: .28*(1-smooth(t/.16)), done:false,
  };
  const forward = t<.16 ? -.025*smooth(t/.16)
    : t<.25 ? -.025+.185*smooth((t-.16)/.09)
    : t<.44 ? .16-.032*smooth((t-.25)/.19)
    : .128*(1-smooth((t-.44)/.28));
  return {pose:t>=.16&&t<.44?'hit' as const:'standing' as const,forward,flash:0,done:false};
}
