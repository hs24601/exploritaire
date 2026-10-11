type UV = readonly [number, number];
export type SpritePart = {
  id: string;
  pivot: UV;
  region?: readonly UV[];
  exclude?: readonly (readonly UV[])[];
  depth: number;
};
export type SpriteRigDefinition = {
  id: string;
  authoredFacing: 'left' | 'right';
  parts: readonly SpritePart[];
};

// Source-image coordinates, measured from its upper left, including its padding.
// These anatomical masks reuse hero.png, rather than introducing duplicate art.
const head: readonly UV[] = [[0,0],[.57,0],[.57,.325],[.52,.36],[.55,.46],[.51,.50],[.46,.54],[.31,.52],[.17,.53],[0,.53]];
const hind: readonly UV[] = [[.65,0],[1,0],[1,1],[.55,1],[.55,.79],[.61,.68],[.63,.58],[.65,.48],[.63,.38]];
export const HERO_SPRITE_RIG: SpriteRigDefinition = {
  id: 'hero', authoredFacing: 'left',
  parts: [
    { id: 'hind', pivot: [.79,.825], region: hind, depth: 0 },
    { id: 'torso', pivot: [.40,.855], exclude: [head, hind], depth: .003 },
    { id: 'head', pivot: [.44,.49], region: head, depth: .006 },
  ],
};
export const WOLF_SPRITE_RIG: SpriteRigDefinition = {
  id: 'wolf', authoredFacing: 'left',
  parts: [{ id: 'body', pivot: [.5,1], depth: 0 }],
};

export type SpritePartPose = { x: number; y: number; angle: number; scaleY: number };
export function sampleSpritePose(part: string, time: number, phase = 0, action = 0, reduced = false): SpritePartPose {
  if (reduced) return { x: 0, y: 0, angle: 0, scaleY: 1 };
  const breath = Math.sin(time * 2.8 + phase), step = Math.sin(time * 16 + phase);
  switch (part) {
    case 'head': return { x: action * .004, y: breath * .003 + action * step * .003, angle: breath * .012 - action * .035, scaleY: 1 };
    case 'torso': return { x: 0, y: 0, angle: action * step * .008, scaleY: 1 + breath * .006 + action * Math.abs(step) * .007 };
    case 'hind': return { x: 0, y: 0, angle: Math.sin(time * 3.2 + phase + .8) * .012 + action * step * .012, scaleY: 1 };
    default: return { x: 0, y: 0, angle: breath * .008, scaleY: 1 + breath * .008 };
  }
}
