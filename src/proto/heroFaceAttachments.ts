import heads from './art/heroHeadLayout.json';
import curious from './art/heroCuriousHeadLayout.json';
import happy from './art/heroHappyHeadLayout.json';
import openingCurious from './art/heroOpeningCuriousHeadLayout.json';
import openingSad from './art/heroOpeningSadHeadLayout.json';
import type { AtlasRect, DirectionalFrame } from './directionalSprites';
export type FaceAttachment = { source: string; rect: AtlasRect; target: AtlasRect; replaceTarget?: AtlasRect };
const walking = [[0,0,1,.72],[0,0,.63,.68],[0,0,.45,.66],[0,0,.40,.54]] as const;
const standing = [[0,0,.78,.57],[0,0,.60,.59],[0,0,.45,.57],[0,0,.33,.43]] as const;
const sitting = [[0,0,.80,.55],[0,0,.70,.55],[0,0,.60,.53],[0,0,.33,.43]] as const;
/** Whole expression heads replace the original head, independent of body/gait. */
export function heroFaceAttachment(frame: DirectionalFrame, emotion: 'sad' | 'neutral' | 'curious' | 'happy' = 'sad', opening = false): FaceAttachment | undefined {
  const walk = frame.source.startsWith('heroWalking'), sit=frame.source.startsWith('heroSitting');
  if(sit && emotion === 'sad' && !opening) return;
  if (!walk && !sit && frame.source !== 'heroLow' && frame.source !== 'heroHigh') return;
  if (frame.id.includes('top') || frame.id.includes('rear') && !frame.id.includes('rear-quarter')) return;
  const direction = frame.id.includes('rear-quarter') ? 3 : frame.id.includes('side') ? 2 : frame.id.includes('front-quarter') ? 1 : 0;
  // The bespoke opening set includes a matching rear-quarter silhouette;
  // legacy heads retain their original unreadable sliver of muzzle.
  if(direction === 3 && !opening) return;
  const high=frame.source.endsWith('High');
  const mirrored=frame.id.includes('-right');
  const target=[...(walk ? walking : sit ? sitting : standing)[direction]] as [number,number,number,number];
  if(mirrored) target[0]=1-target[0]-target[2];
  const replaceTarget = [...target] as [number,number,number,number];
  // Keep the neck anchor while matching the authored body's head proportions.
  // Erase the full old head independently, so shrinking cannot expose its face.
  const scale = opening ? 1 : .86;
  target[0] += target[2] * (1-scale) / 2;
  target[1] += target[3] * (1-scale);
  target[2] *= scale;
  target[3] *= scale;
  // Quarter/side necks sit toward the torso, rather than at the crop's left edge.
  if (direction > 0) target[0] += (mirrored ? -1 : 1) * (direction === 1 ? .055 : .035);
  const atlas = emotion === 'happy' ? happy : emotion === 'curious' ? (opening ? openingCurious : curious) : emotion === 'sad' && opening ? openingSad : heads[emotion];
  const rect = [...atlas[(high?4:0)+direction]] as [number,number,number,number];
  // Packing measures the opaque core. Include the translucent painted fringe;
  // clipping it at that core creates straight edges that the outline amplifies.
  const padding = 8, dx = target[2] * padding / rect[2], dy = target[3] * padding / rect[3];
  target[0] -= dx; target[1] -= dy; target[2] += dx*2; target[3] += dy*2;
  rect[0] -= padding; rect[1] -= padding; rect[2] += padding*2; rect[3] += padding*2;
  return {source:emotion==='happy'?'heroHappyHeads':emotion==='sad'?'heroSadHeads':emotion==='curious'?'heroCuriousHeads':'heroNeutralHeads',rect,target,replaceTarget};
}
