import sitting from './art/heroSittingLayout.json';
import type { AtlasRect, DirectionalFrame } from './directionalSprites';

export type FaceAttachment = { source: string; rect: AtlasRect; target: AtlasRect };
// Source face-only washes are reused across bodies. Target rectangles use each
// body's own registration grid, including every gait phase, never camera space.
const faceMasks = [[.06,.19,.68,.39],[0,.20,.62,.41],[0,.19,.51,.40],[0,.16,.32,.35]] as const;
const walking = [[.02,.19,.96,.46],[0,.18,.53,.44],[0,.15,.34,.48],[0,.15,.30,.39]] as const;
const standing = [[0,.17,.74,.40],[0,.12,.58,.42],[0,.03,.41,.42],[0,.03,.30,.32]] as const;

export function heroFaceAttachment(frame: DirectionalFrame): FaceAttachment | undefined {
  const walk = frame.source.startsWith('heroWalking');
  if (!walk && frame.source !== 'heroLow' && frame.source !== 'heroHigh') return;
  if (frame.id.includes('top') || frame.id.includes('rear') && !frame.id.includes('rear-quarter')) return;
  const direction = frame.id.includes('rear-quarter') ? 3 : frame.id.includes('side') ? 2 : frame.id.includes('front-quarter') ? 1 : 0;
  const tier = frame.source.endsWith('High') ? 'high' : 'low';
  const [x,y,w,h] = sitting[tier].rects[direction];
  const [mx,my,mw,mh] = faceMasks[direction];
  return { source: `heroSitting${tier === 'low' ? 'Low' : 'High'}SadFace`,
    rect: [x+mx*w,y+my*h,mw*w,mh*h], target: (walk ? walking : standing)[direction] };
}
