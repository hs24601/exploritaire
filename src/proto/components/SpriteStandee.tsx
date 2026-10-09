import { useEffect, type ReactNode } from 'react';
import { rgba, type StandeeLighting, type StandeeShadow } from '../protoLighting';
import { spriteLayout, useSpriteBounds } from './spriteBounds';

/** Tilted pieces are 3D layers, which the browser rasterizes at their layout
 * size and then stretches with the camera's zoom and perspective, so pixel
 * art went soft as the camera zoomed in. A standee is laid out this many
 * times larger and scaled back down inside its own 3D transform, so its layer
 * holds that many times the pixels and zooming only ever shrinks it. */
export const STANDEE_OVERSAMPLE = 6;

/** Inside an oversampled standee: lays its children out at their normal
 * size, enlarged with layout zoom so nested filters and canvases paint at
 * the larger resolution before the outer standee transform shrinks it. */
export function Oversample({ width, height, factor, children }: { width: number; height: number; factor: number; children: ReactNode }) {
  if (factor === 1) return <>{children}</>;
  return <span className="proto-oversample" style={{ width, height, zoom: factor }}>{children}</span>;
}

/** Box an actor's sprite standee stands in, in table px (two thirds of a grid
 * square, so the actor reads as a figure on its square rather than filling it). */
export const SPRITE_STANDEE_SIZE = 32;

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
  return <>
    <span aria-hidden="true" className="proto-sprite-standee__art" style={{ backgroundImage: `url("${sprite}")`, backgroundSize: layout.size, backgroundPosition: layout.position, filter }} />
    <LightWash sprite={sprite} lighting={lighting} maskSize={layout.size} maskPosition={layout.position} />
  </>;
}

const SHADE = { r: 8, g: 6, b: 22 };

/** Directional light across a lit cut-out, the way HD-2D sprites catch a
 * lamp: the side facing the strongest nearby light glows in its colour and
 * the far side falls into shade; a light in front washes the whole face, one
 * behind leaves a rim along the top. Two layers masked to the sprite's own
 * pixels, so nothing spills outside the art. `flip` is for art mirrored in
 * place, so the light still comes from the world side it's on. */
export function LightWash({ sprite, lighting, maskSize, maskPosition, flip = false }: { sprite: string; lighting: StandeeLighting; maskSize: string; maskPosition: string; flip?: boolean }) {
  const rim = lighting.rim;
  if (!rim || rim.amount < 0.03) return null;
  const side = (flip ? -rim.x : rim.x);
  const front = Math.max(0, rim.y);
  const alpha = Math.min(0.7, rim.amount * (0.38 + 0.3 * front));
  const toward = side > 0 ? 90 : 270;
  let light: string;
  let shade: string | null = null;
  if (Math.abs(side) >= 0.25) {
    light = `linear-gradient(${toward}deg, ${rgba(rim.color, 0)} 25%, ${rgba(rim.color, alpha)})`;
    shade = `linear-gradient(${toward + 180}deg, ${rgba(SHADE, 0)} 30%, ${rgba(SHADE, rim.amount * 0.55 * (1 - front))})`;
  } else if (rim.y > 0) {
    light = `linear-gradient(${rgba(rim.color, alpha * 0.55)}, ${rgba(rim.color, alpha * 0.4)})`;
  } else {
    light = `linear-gradient(180deg, ${rgba(rim.color, alpha)}, ${rgba(rim.color, 0)} 35%)`;
    shade = `linear-gradient(${rgba(SHADE, rim.amount * 0.2)}, ${rgba(SHADE, rim.amount * 0.4)})`;
  }
  const mask = `url("${sprite}")`;
  const masked = { maskImage: mask, WebkitMaskImage: mask, maskSize, WebkitMaskSize: maskSize, maskPosition, WebkitMaskPosition: maskPosition };
  return <>
    {shade ? <span aria-hidden="true" className="proto-light-wash proto-light-wash--shade" style={{ ...masked, backgroundImage: shade }} /> : null}
    <span aria-hidden="true" className="proto-light-wash" data-light-wash="true" style={{ ...masked, backgroundImage: light }} />
  </>;
}

/** A standee is a flat board facing the camera, so its shadow keeps its base
 * on the board's foot line and leans away from the light (a shear), rather
 * than spinning the whole silhouette around the foot. Spinning made wide
 * pieces like the Small Woods pines cast from beside their trunks. The shadow
 * never flattens to a sliver when the light grazes along the board. */
export const standeeShadowSkew = (angleDeg: number) => {
  const radians = (angleDeg * Math.PI) / 180;
  const dirX = Math.sin(radians);
  const rawY = -Math.cos(radians);
  const dirY = Math.sign(rawY || -1) * Math.max(0.35, Math.abs(rawY));
  return `matrix(1, 0, ${(-dirX).toFixed(4)}, ${(-dirY).toFixed(4)}, 0, 0)`;
};

/** Silhouettes the standee casts on the table, one per light, each falling
 * away from its light and lengthening as the light gets lower. The board
 * faces a camera spun by `yaw`, so its shadow's foot line turns by -yaw on
 * the table (shadow angles from standeeLighting are already in that frame). */
export function SpriteStandeeShadows({ sprite, position, shadows, size = SPRITE_STANDEE_SIZE, owner, yaw = 0 }: { sprite: string; position: { x: number; y: number }; shadows: StandeeShadow[]; size?: number; owner?: string; yaw?: number }) {
  const state = useSpriteBounds(sprite);
  if (state?.status !== 'ready') return null;
  return <>{shadows.map((shadow) => {
    const layout = spriteLayout(state.bounds, size, size, shadow.length);
    const mask = `url("${sprite}")`;
    return <div key={shadow.lightId} aria-hidden="true" className="proto-sprite-shadow" data-shadow-light={shadow.lightId} data-shadow-owner={owner} style={{
      left: `calc(50% + ${position.x}px)`, top: `calc(50% + ${position.y}px)`,
      width: size, height: size * shadow.length,
      transform: `translate3d(-50%, -100%, 0.5px)${yaw ? ` rotate(${(-yaw).toFixed(2)}deg)` : ''} ${standeeShadowSkew(shadow.angle)}`, opacity: shadow.opacity,
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
 * itself faces the horizon and isn't visible; its shadow on the table is. A
 * `label` (the piece's name) sits just above the board, which underlines it. */
export function SpriteTopDownArt({ sprite, lighting, onError, size = SPRITE_STANDEE_SIZE, base = true, label }: { sprite: string; lighting: StandeeLighting; onError?: () => void; size?: number; base?: boolean; label?: string }) {
  const state = useSpriteBounds(sprite);
  const failed = state?.status === 'error';
  useEffect(() => { if (failed) onError?.(); }, [failed, onError]);
  if (state?.status !== 'ready') return null;
  const width = Math.round(state.bounds.aspect >= 1 ? size : size * state.bounds.aspect);
  const shade = `brightness(${lighting.brightness.toFixed(3)}) sepia(${(lighting.warmth * 0.45).toFixed(3)})`;
  // The board faces the camera, so it turns against a spun camera; its name
  // stays upright with it.
  return <span aria-hidden="true" className="proto-sprite-topdown__piece proto-face-camera" style={{ filter: shade }}>
    {base ? <span className="proto-sprite-topdown__base" style={{ width: Math.round(size * 0.75), height: Math.round(size * 0.75) }} /> : null}
    <span className="proto-sprite-topdown__board" style={{ width, height: TOP_DOWN_BOARD_THICKNESS }} />
    {label ? <span className="proto-sprite-topdown__name" style={{ bottom: `calc(50% + ${TOP_DOWN_BOARD_THICKNESS / 2}px)` }}>{label}</span> : null}
  </span>;
}
