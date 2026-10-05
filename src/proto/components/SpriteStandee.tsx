import { useEffect } from 'react';
import { rgba, type StandeeLighting, type StandeeShadow } from '../protoLighting';
import { spriteLayout, useSpriteBounds } from './spriteBounds';

/** Box a sprite standee stands in, in table px. */
export const SPRITE_STANDEE_SIZE = 64;

/** The standee's face: trimmed pixel art, shaded by the light reaching it with
 * a warm rim on the side facing the strongest nearby light. */
export function SpriteStandeeArt({ sprite, lighting, onError }: { sprite: string; lighting: StandeeLighting; onError: () => void }) {
  const state = useSpriteBounds(sprite);
  const failed = state?.status === 'error';
  useEffect(() => { if (failed) onError(); }, [failed, onError]);
  if (state?.status !== 'ready') return null;
  const layout = spriteLayout(state.bounds, SPRITE_STANDEE_SIZE, SPRITE_STANDEE_SIZE);
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
export function SpriteStandeeShadows({ sprite, position, shadows }: { sprite: string; position: { x: number; y: number }; shadows: StandeeShadow[] }) {
  const state = useSpriteBounds(sprite);
  if (state?.status !== 'ready') return null;
  return <>{shadows.map((shadow) => {
    const layout = spriteLayout(state.bounds, SPRITE_STANDEE_SIZE, SPRITE_STANDEE_SIZE, shadow.length);
    const mask = `url("${sprite}")`;
    return <div key={shadow.lightId} aria-hidden="true" className="proto-sprite-shadow" data-shadow-light={shadow.lightId} style={{
      left: `calc(50% + ${position.x}px)`, top: `calc(50% + ${position.y}px)`,
      width: SPRITE_STANDEE_SIZE, height: SPRITE_STANDEE_SIZE * shadow.length,
      transform: `translate3d(-50%, -100%, 0.5px) rotate(${shadow.angle.toFixed(2)}deg)`, opacity: shadow.opacity,
      maskImage: mask, WebkitMaskImage: mask, maskSize: layout.size, WebkitMaskSize: layout.size, maskPosition: layout.position, WebkitMaskPosition: layout.position,
    }} />;
  })}</>;
}
