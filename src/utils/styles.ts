import type { CSSProperties } from 'react';

/**
 * Shared neon-style glow utilities for consistent visual effects.
 */

/** Simple outer glow: `0 0 <size>px <color>` */
export function neonGlow(color: string, size: number = 10): CSSProperties {
  return { boxShadow: `0 0 ${size}px ${color}` };
}

/** Outer glow with optional inset: `0 0 <size>px <color>, inset 0 0 <inset>px <color><hex>` */
export function neonGlowInset(
  color: string,
  outerSize: number = 15,
  insetSize: number = 10,
  insetOpacityHex: string = '33',
): CSSProperties {
  return {
    boxShadow: `0 0 ${outerSize}px ${color}, inset 0 0 ${insetSize}px ${color}${insetOpacityHex}`,
  };
}

/** Text neon glow: `0 0 <size>px <color>` */
export function neonText(color: string, size: number = 10): CSSProperties {
  return { textShadow: `0 0 ${size}px ${color}` };
}

/** Title text shadow with depth + glow: `0 1px 2px rgba(0,0,0,<depth>), 0 0 <size>px <color><hex>` */
export function titleTextShadow(
  color: string,
  glowHex: string = '66',
  glowSize: number = 6,
  depthOpacity: number = 0.8,
): CSSProperties {
  return {
    textShadow: `0 1px 2px rgba(0, 0, 0, ${depthOpacity}), 0 0 ${glowSize}px ${color}${glowHex}`,
  };
}

/**
 * Named game colors used throughout the UI.
 * Centralizes the rgba/hex values that appear in inline styles.
 */
export const NEON_COLORS = {
  gold: '#e6b31e',
  goldRgba: (a: number) => `rgba(230, 179, 30, ${a})`,
  purple: '#8b5cf6',
  purpleRgba: (a: number) => `rgba(139, 92, 246, ${a})`,
  teal: '#7fdbca',
  tealRgba: (a: number) => `rgba(127, 219, 202, ${a})`,
  red: '#ff6b6b',
  redRgba: (a: number) => `rgba(255, 107, 107, ${a})`,
  orange: '#f97316',
  orangeRgba: (a: number) => `rgba(249, 115, 22, ${a})`,
  blue: '#38bdf8',
  blueRgba: (a: number) => `rgba(56, 189, 248, ${a})`,
  pink: '#d946ef',
  pinkRgba: (a: number) => `rgba(217, 70, 239, ${a})`,
} as const;

/**
 * Universal border width for game objects (cards, tiles, tokens, slots, previews).
 * Returns a pixel value of 3 so borders are prominently visible and scale
 * naturally with the camera transform.
 */
export const GAME_BORDER_WIDTH = 1;

/** The "no valid moves" warning badge style */
export const NO_MOVES_BADGE_STYLE: CSSProperties = {
  borderColor: NEON_COLORS.red,
  color: NEON_COLORS.red,
  boxShadow: `0 0 10px ${NEON_COLORS.redRgba(0.5)}`,
};
