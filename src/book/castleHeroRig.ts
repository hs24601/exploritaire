import {HERO_DIRECTIONAL_SPRITE, selectSpriteView, type SpriteView} from '../proto/directionalSprites';
import walking from '../proto/art/heroWalkingLayout.json';

/** Page 117's Hero uses the combat directional rig (the same watercolor sheets
 * as battle): five authored views from front to rear, mirrored for the other
 * side, so the over-the-shoulder camera sees her from behind instead of in the
 * side-scroller's profile. Pure selection; the renderer applies the rectangle. */
export const HERO_RIG_SHEETS = {
  standing: 'characters/hero/rig/watercolor/v3/hero-directions-low-body-v3.png',
  walking: 'characters/hero/poses/watercolor/v1-opening/hero-walking-low-v1.png',
  standingHigh: 'characters/hero/rig/watercolor/v4/hero-directions-high-body-v4.png',
  standingRearHigh: 'characters/hero/rig/watercolor/v5/hero-standing-rear-high-v5.png',
  walkingHigh: 'characters/hero/poses/watercolor/v1-opening/hero-walking-high-v1.png',
} as const;
export const HERO_RIG_SIZE = {standing: [1122, 1402], walking: [1512, 1460], standingHigh: [1024, 1536], standingRearHigh: [192, 270], walkingHigh: [walking.high.width, walking.high.height]} as const;

type Rect = readonly [number, number, number, number];

/** Metres per sheet pixel; the walking sheet is painted ~1.255× smaller, so its
 * frames scale up to keep her the same size. Front standing view ≈ 0.95 m tall. */
const STAND_MPP = .95 / 251, WALK_MPP = STAND_MPP * 1.255;
// Exchange the low standees before the castle's descending view exposes their upright silhouettes.
const HIGH_VIEW_THRESHOLD = 34 * Math.PI / 180;
const HIGH_REAR_RECT: Rect = [0, 0, ...HERO_RIG_SIZE.standingRearHigh];

/** Plan-view angle of a direction (x, z), shared by heading and camera bearing. */
export const bearing = (x: number, z: number) => Math.atan2(x, z);

export type HeroRigFrame = {sheet: keyof typeof HERO_RIG_SHEETS; rect: Rect; width: number; height: number; flip: number; view: SpriteView};

export function heroRigFrame(heading: number, toCamera: number, gait: 'idle' | 'walk' | 'run', clock: number, previous?: SpriteView, elevation = 0): HeroRigFrame {
  const view = selectSpriteView(heading, toCamera, elevation, previous, HIGH_VIEW_THRESHOLD);
  const top = view.elevation === 'top';
  const high = view.elevation !== 'low';
  if (gait === 'idle') {
    const elevatedRear = view.elevation === 'high' && view.direction === 4;
    const frame = top ? HERO_DIRECTIONAL_SPRITE.top : HERO_DIRECTIONAL_SPRITE[high ? 'high' : 'low'][view.direction];
    const rect = elevatedRear ? HIGH_REAR_RECT : frame.parts[0].rect;
    const sheet = elevatedRear ? 'standingRearHigh' : high ? 'standingHigh' : 'standing';
    return {sheet, rect, width: rect[2] * STAND_MPP, height: rect[3] * STAND_MPP, flip: view.flip, view};
  }
  const phase = Math.floor(clock * (gait === 'run' ? 11 : 6)) % 4;
  const rect = (high ? walking.high : walking.low).rects[top ? 5 : view.direction][phase] as unknown as Rect;
  return {sheet: high ? 'walkingHigh' : 'walking', rect, width: rect[2] * WALK_MPP, height: rect[3] * WALK_MPP, flip: view.flip, view};
}
