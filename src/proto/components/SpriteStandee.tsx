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

/** Even, neutral light for standees shown outside the table (the foundation). */
export const NEUTRAL_STANDEE_LIGHTING: StandeeLighting = { brightness: 1, warmth: 0, lightColor: { r: 255, g: 255, b: 255 }, rim: null, shadows: [] };

/** How much a standee's face shortens when the flat (top-down) camera looks
 * down on it, and how thick its cardboard edge reads from above. */
export const TOP_DOWN_FORESHORTEN = 0.58;
/** The top-down piece's foot sits this far below its cell center, so the
 * foreshortened piece reads as centered in the cell. */
export const TOP_DOWN_FOOT_OFFSET = 14;
const TOP_DOWN_EDGE_LAYERS = 5;

/** A standee seen from above: the art face foreshortened toward its base, with
 * the thick corrugated-cardboard edge showing along its upper outline, standing
 * in a round base. */
export function SpriteTopDownArt({ sprite, lighting, onError, size = SPRITE_STANDEE_SIZE }: { sprite: string; lighting: StandeeLighting; onError?: () => void; size?: number }) {
  const state = useSpriteBounds(sprite);
  const failed = state?.status === 'error';
  useEffect(() => { if (failed) onError?.(); }, [failed, onError]);
  if (state?.status !== 'ready') return null;
  const layout = spriteLayout(state.bounds, size, size);
  const mask = `url("${sprite}")`;
  const silhouette = { maskImage: mask, WebkitMaskImage: mask, maskSize: layout.size, WebkitMaskSize: layout.size, maskPosition: layout.position, WebkitMaskPosition: layout.position };
  const shade = `brightness(${lighting.brightness.toFixed(3)}) sepia(${(lighting.warmth * 0.45).toFixed(3)})`;
  return <span aria-hidden="true" className="proto-sprite-topdown__piece">
    <span className="proto-sprite-topdown__base" />
    {Array.from({ length: TOP_DOWN_EDGE_LAYERS }, (_, index) => {
      const depth = TOP_DOWN_EDGE_LAYERS - index;
      // Kraft liners on both faces of the board, fluting between them.
      const liner = depth === TOP_DOWN_EDGE_LAYERS || depth === 1;
      return <span key={depth} className={`proto-sprite-topdown__edge${liner ? ' proto-sprite-topdown__edge--liner' : ''}`}
        style={{ ...silhouette, transform: `translateY(${-depth}px) scaleY(${TOP_DOWN_FORESHORTEN})`, filter: `${shade} brightness(${(0.78 + index * 0.03).toFixed(2)})` }} />;
    })}
    <span className="proto-sprite-standee__art proto-sprite-topdown__face"
      style={{ backgroundImage: mask, backgroundSize: layout.size, backgroundPosition: layout.position, transform: `scaleY(${TOP_DOWN_FORESHORTEN})`, filter: shade }} />
  </span>;
}
