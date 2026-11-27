/** Placeholder art for the ?city table: existing kin/enemy sprites plus small SVG glyphs for tokens and resource cards. */
import type { CSSProperties, ReactElement } from 'react';
import type { KinId, ResourceId } from './rules/cityRules';
import type { FoeKind } from './rules/combatRules';

const base = import.meta.env.BASE_URL;
type Sprite = { src: string; sheet?: [number, number] };
const KIN_ART: Record<KinId, Sprite> = {
  hero: { src: 'assets/runtime/kin/hero/sprites/world/opening-poses/hero-happy-emoji-v1.png' },
  mochi: { src: 'assets/runtime/kin/mochi/expressions/watercolor-emojis/mochi_emoji_happy.png' },
  banks: { src: 'assets/runtime/kin/banks/expressions/neutral-frontal/banks_emoji_happy.png' },
  demi: { src: 'assets/runtime/kin/demi/expressions/demi-expressions-v1.png', sheet: [4, 3] },
  cir: { src: 'assets/runtime/keru/cir/cir-expression-neutral-v2.png' },
  riv: { src: 'assets/runtime/keru/riv/riv-watercolor-v2.png' },
};
const FOE_ART: Record<FoeKind, Sprite> = {
  slime: { src: 'assets/runtime/creatures/dark-slime/sprites/combat/watercolor-directions/dark-slime-directions-watercolor-v1.png', sheet: [3, 3] },
  root: { src: 'assets/runtime/ui/quests/khad-roots-berry-bush-night-paint-v1.png' },
};

function SpriteView({ sprite, label, className }: { sprite: Sprite; label: string; className?: string }) {
  const style: CSSProperties = {
    backgroundImage: `url("${base}${sprite.src}")`,
    backgroundSize: sprite.sheet ? `${sprite.sheet[0] * 100}% ${sprite.sheet[1] * 100}%` : 'contain',
    backgroundPosition: sprite.sheet ? '0 0' : 'center',
  };
  return <span className={`city-sprite ${className ?? ''}`} style={style} role="img" aria-label={label} />;
}
export const KinPortrait = ({ kin, label }: { kin: KinId; label: string }) => <SpriteView sprite={KIN_ART[kin]} label={label} className={`city-sprite--${kin}`} />;
export const FoePortrait = ({ kind, label }: { kind: FoeKind; label: string }) => <SpriteView sprite={FOE_ART[kind]} label={label} className={`city-sprite--${kind}`} />;

const GLYPHS: Record<ResourceId, ReactElement> = {
  berry: <g><circle cx="9" cy="14" r="5" fill="#7a2a5a" /><circle cx="16" cy="12" r="5" fill="#93336b" /><circle cx="12" cy="18" r="5" fill="#6a2150" /><path d="M12 9c1-4 4-5 7-5-1 3-3 5-7 5z" fill="#4f7a3a" /></g>,
  dried: <g><circle cx="9" cy="13" r="4" fill="#6b3a2a" /><circle cx="15" cy="12" r="4" fill="#7e4632" /><circle cx="12" cy="18" r="4" fill="#5a2f22" /><path d="M4 21h16" stroke="#c9a36a" strokeWidth="2" /></g>,
  fish: <g><path d="M3 12c4-6 11-6 15 0-4 6-11 6-15 0z" fill="#5f8ea0" /><path d="M18 12l4-4v8z" fill="#4b7384" /><circle cx="7" cy="11" r="1.2" fill="#1f1c19" /></g>,
  wood: <g><rect x="2" y="7" width="17" height="11" rx="2" fill="#7b5230" /><path d="M4 10h11M5 14h9" stroke="#5a3a1e" strokeWidth="1" /><ellipse cx="19" cy="12.5" rx="3.4" ry="5.5" fill="#e2c08e" stroke="#5a3a1e" strokeWidth=".8" /><path d="M19 9.5a1.6 3 0 1 1 0 6" fill="none" stroke="#b08850" strokeWidth=".8" /><circle cx="19" cy="12.5" r=".8" fill="#8a5d36" /></g>,
  stone: <g><path d="M4 17l3-7 6-3 6 3 2 7-5 3H8z" fill="#8b8f8c" /><path d="M7 10l6-3 6 3-5 2z" fill="#a9ada9" /></g>,
  reed: <g><path d="M8 21V6M12 21V3M16 21V7" stroke="#6f8a3c" strokeWidth="2" /><rect x="11" y="4" width="2.4" height="6" rx="1.2" fill="#7b5230" /><rect x="7" y="7" width="2.2" height="5" rx="1.1" fill="#7b5230" /></g>,
};
export const ResourceGlyph = ({ r, size = 24 }: { r: ResourceId; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">{GLYPHS[r]}</svg>
);
