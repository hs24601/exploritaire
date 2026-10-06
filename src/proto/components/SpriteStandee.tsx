import { useEffect } from 'react';
import { rgba, type StandeeLighting, type StandeeShadow } from '../protoLighting';
import { spriteLayout, useSpriteBounds } from './spriteBounds';

/** Box a sprite standee stands in, in table px. */
export const SPRITE_STANDEE_SIZE = 64;

/** The standee's face: trimmed pixel art, shaded by the light reaching it with
 * a warm rim on the side facing the strongest nearby light. */
export function SpriteStandeeArt({ sprite, lighting, onError, size = SPRITE_STANDEE_SIZE }: { sprite: string; lighting: StandeeLighting; onError?: () => void; size?: number }) {
  const state = useSpriteBounds(sprite);
  const failed = state?.status === 'error';
  useEffect(() => { if (failed) onError?.(); }, [failed, onError]);
  if (state?.status !== 'ready') return null;
  const layout = spriteLayout(state.bounds, size, size);
  const { rim } = lighting;
  const filter = [
    `brightness(${lighting.brightness.toFixed(3)})`,
    `sepia(${(lighting.warmth * 0.45).toFixed(3)})`,
    rim ? `drop-shadow(${(rim.x * 2).toFixed(2)}px ${(-1 - Math.abs(rim.y)).toFixed(2)}px 1px ${rgba(rim.color, rim.amount * 0.8)})` : '',
  ].filter(Boolean).join(' ');
  return <span aria-hidden="true" className="proto-sprite-standee__art" style={{ backgroundImage: `url("${sprite}")`, backgroundSize: layout.size, backgroundPosition: layout.position, filter }} />;
}

/** Silhouettes the standee casts on the table, one per light, each falling
 * away from its light and lengthening as the light gets lower. */
export function SpriteStandeeShadows({ sprite, position, shadows, size = SPRITE_STANDEE_SIZE, owner }: { sprite: string; position: { x: number; y: number }; shadows: StandeeShadow[]; size?: number; owner?: string }) {
  const state = useSpriteBounds(sprite);
  if (state?.status !== 'ready') return null;
  return <>{shadows.map((shadow) => {
    const layout = spriteLayout(state.bounds, size, size, shadow.length);
    const mask = `url("${sprite}")`;
    return <div key={shadow.lightId} aria-hidden="true" className="proto-sprite-shadow" data-shadow-light={shadow.lightId} data-shadow-owner={owner} style={{
      left: `calc(50% + ${position.x}px)`, top: `calc(50% + ${position.y}px)`,
      width: size, height: size * shadow.length,
      transform: `translate3d(-50%, -100%, 0.5px) rotate(${shadow.angle.toFixed(2)}deg)`, opacity: shadow.opacity,
      maskImage: mask, WebkitMaskImage: mask, maskSize: layout.size, WebkitMaskSize: layout.size, maskPosition: layout.position, WebkitMaskPosition: layout.position,
    }} />;
  })}</>;
}

/** Even, neutral light for standees shown outside the table (the foundation). */
export const NEUTRAL_STANDEE_LIGHTING: StandeeLighting = { brightness: 1, warmth: 0, lightColor: { r: 255, g: 255, b: 255 }, rim: null, shadows: [] };

/** Seen from straight above, the standee is just its board edge: this thick. */
export const TOP_DOWN_BOARD_THICKNESS = 3.5;

/** A standee seen from directly overhead: only the top edge of its corrugated
 * board shows, as wide as the cut-out, standing across its round base. The art
 * itself faces the horizon and isn't visible; its shadow on the table is. */
export function SpriteTopDownArt({ sprite, lighting, onError, size = SPRITE_STANDEE_SIZE, base = true }: { sprite: string; lighting: StandeeLighting; onError?: () => void; size?: number; base?: boolean }) {
  const state = useSpriteBounds(sprite);
  const failed = state?.status === 'error';
  useEffect(() => { if (failed) onError?.(); }, [failed, onError]);
  if (state?.status !== 'ready') return null;
  const width = Math.round(state.bounds.aspect >= 1 ? size : size * state.bounds.aspect);
  const shade = `brightness(${lighting.brightness.toFixed(3)}) sepia(${(lighting.warmth * 0.45).toFixed(3)})`;
  return <span aria-hidden="true" className="proto-sprite-topdown__piece" style={{ filter: shade }}>
    {base ? <span className="proto-sprite-topdown__base" /> : null}
    <span className="proto-sprite-topdown__board" style={{ width, height: TOP_DOWN_BOARD_THICKNESS }} />
  </span>;
}
