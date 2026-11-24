import { createQuadrupedSpriteDefinition, type QuadrupedLayout, type QuadrupedMotionProfile } from './quadrupedSprite';

export type SpriteView = { direction: number; elevation: 'low' | 'high' | 'top'; flip: number };
const TAU = Math.PI * 2;
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Five authored horizontal views + mirroring give eight compass directions.
 * Direction is relative to the actor's heading, never to the actor's team or screen position.
 * Elevated art and a world-aligned overhead frame cover the full upper camera hemisphere.
 */
export function selectSpriteView(heading: number, viewYaw: number, elevation: number, previous?: SpriteView): SpriteView {
  const relative = wrap(viewYaw - heading), magnitude = Math.abs(relative);
  let direction = Math.min(4, Math.round(magnitude / (TAU / 8)));
  if (previous && Math.abs(magnitude - previous.direction * Math.PI / 4) < Math.PI / 8 + .055) direction = previous.direction;
  let tier: SpriteView['elevation'] = elevation > 72 * Math.PI / 180 ? 'top' : elevation > 40 * Math.PI / 180 ? 'high' : 'low';
  if (previous?.elevation === 'top' && elevation > 68 * Math.PI / 180) tier = 'top';
  else if (previous?.elevation === 'high' && elevation > 36 * Math.PI / 180 && elevation < 76 * Math.PI / 180) tier = 'high';
  else if (previous?.elevation === 'low' && elevation < 44 * Math.PI / 180) tier = 'low';
  return { direction, elevation: tier, flip: tier === 'top' || direction === 0 || direction === 4 ? 1 : relative >= 0 ? 1 : -1 };
}

export type AtlasRect = readonly [number, number, number, number];
export type SpritePoint = readonly [number, number];
export type DirectionalPart = { id: string; rect: AtlasRect; x: number; y: number; height: number; depth: number; pivot?: SpritePoint; clip?: readonly SpritePoint[]; parent?: string };
export type DirectionalFrame = { id: string; source: string; parts: readonly DirectionalPart[]; outline?: readonly SpritePoint[] };
export type DirectionalSpriteDefinition = { id: string; low: readonly DirectionalFrame[]; high: readonly DirectionalFrame[]; lowOpposite?: readonly DirectionalFrame[]; highOpposite?: readonly DirectionalFrame[]; top: DirectionalFrame; motion: 'quadruped' | 'slime'; motionProfile?: QuadrupedMotionProfile };

// The independently generated pieces do not share anatomy/pixel scale. Their
// stitched pose stretched the neck and doubled the hips. Use the coherent
// reference silhouette already in each atlas instead, with three authored UV
// regions on ONE registration grid. Neutral assembly preserves every pixel.
const low: readonly AtlasRect[] = [[48,20,206,251],[41,289,272,248],[19,546,321,254],[25,812,291,256],[55,1080,183,273]];
const high: readonly AtlasRect[] = [[44,43,194,228],[44,274,242,228],[28,509,286,242],[41,753,258,254]];
const names = ['front', 'front-quarter', 'side', 'rear-quarter', 'rear'];
// Hero's authored registration is preserved by the shared quadruped factory.
const heroLayouts: readonly QuadrupedLayout[] = [
  {kind:'side',neck:[[.78,0],[.78,.31],[.75,.51],[.55,.68],[0,.54]],hip:[[.82,0],[.78,.32],[.78,.77],[.92,1]],pivots:[[.50,.44],[.50,.48],[.82,.51]]},
  {kind:'side',neck:[[.60,0],[.60,.32],[.52,.52],[.37,.66],[0,.60]],hip:[[.66,0],[.63,.50],[.64,.72],[.58,1]],pivots:[[.43,.48],[.49,.48],[.64,.50]]},
  {kind:'side',neck:[[.49,0],[.50,.27],[.41,.48],[.28,.62],[0,.66]],hip:[[.68,0],[.67,.40],[.64,.65],[.59,1]],pivots:[[.36,.51],[.47,.49],[.66,.51]]},
  {kind:'side',neck:[[.47,0],[.46,.22],[.38,.40],[.21,.49],[0,.43]],hip:[[.58,0],[.57,.32],[.54,.55],[.47,1]],pivots:[[.32,.63],[.44,.56],[.55,.52]]},
  {kind:'stacked',neck:[[0,.33],[.25,.31],[.5,.39],[.75,.31],[1,.33]],hip:[[0,.52],[.25,.46],[.5,.42],[.75,.46],[1,.52]],pivots:[[.50,.66],[.50,.55],[.50,.51]]},
];
export const HERO_DIRECTIONAL_SPRITE = createQuadrupedSpriteDefinition({
  id:'hero',
  low:low.map((rect,i)=>({source:'heroLow',rect,layout:heroLayouts[i]})),
  high:[...high.map((rect,i)=>({source:'heroHigh',rect,layout:heroLayouts[i]})),{source:'heroLow',rect:low[4],layout:heroLayouts[4]}],
  top:{source:'heroHigh',rect:[71,1022,174,398],layout:{kind:'stacked',neck:[[0,.33],[.5,.35],[1,.33]],hip:[[0,.62],[.5,.59],[1,.62]],pivots:[[.5,.67],[.5,.55],[.5,.39]]}},
});
const slimeRects: readonly AtlasRect[] = [[38,114,357,269],[449,102,360,281],[874,104,350,274],[40,495,344,275],[448,501,361,269],[875,522,334,257],[41,896,344,261],[448,893,353,264],[882,883,327,302]];
const slimeFrame = (index: number, id: string): DirectionalFrame => ({ id, source: 'slime', parts: [{ id: 'body', rect: slimeRects[index], x: 0, y: .5, height: 1, depth: 0, pivot: [.5,0] }] });
export const DARK_SLIME_DIRECTIONAL_SPRITE: DirectionalSpriteDefinition = {
  id: 'dark-slime', motion: 'slime', low: names.map((name,i) => slimeFrame(i, `low-${name}`)),
  high: [slimeFrame(0,'high-front'),slimeFrame(5,'high-front-quarter'),slimeFrame(6,'high-side'),slimeFrame(7,'high-rear-quarter'),slimeFrame(4,'high-rear')],
  top: slimeFrame(8,'top'),
};

