import { memo } from 'react';
import type { OrimRarity } from '../engine/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const RARITY_RGB: Record<OrimRarity, string> = {
  common:    '188, 189, 203',
  uncommon:  '142, 227, 165',
  rare:      '95, 127, 232',
  epic:      '132, 104, 216',
  legendary: '242, 154, 88',
  mythic:    '222, 91, 117',
};

const RARITY_GLOW_PX: Record<OrimRarity, number> = {
  common:    8,
  uncommon:  14,
  rare:      20,
  epic:      26,
  legendary: 36,
  mythic:    48,
};

const RARITY_GLOW_ALPHA: Record<OrimRarity, number> = {
  common:    0.40,
  uncommon:  0.50,
  rare:      0.60,
  epic:      0.70,
  legendary: 0.85,
  mythic:    0.95,
};

const SHIMMER_DURATION: Partial<Record<OrimRarity, number>> = {
  uncommon:  5,
  rare:      4,
  epic:      3,
  legendary: 2.5,
  mythic:    2,
};

const SHIMMER_OPACITY: Partial<Record<OrimRarity, number>> = {
  uncommon:  0.18,
  rare:      0.22,
  epic:      0.26,
  legendary: 0.30,
  mythic:    0.34,
};

// Fractional (0–1) positions around the card perimeter for border sparkle dots
const SPARKLE_RING: Array<{ x: number; y: number; delay: number }> = [
  { x: 0.20, y: 0.00, delay: 0.0 },
  { x: 0.80, y: 0.00, delay: 0.4 },
  { x: 1.00, y: 0.28, delay: 0.8 },
  { x: 1.00, y: 0.72, delay: 1.2 },
  { x: 0.80, y: 1.00, delay: 0.6 },
  { x: 0.20, y: 1.00, delay: 1.6 },
  { x: 0.00, y: 0.72, delay: 1.0 },
  { x: 0.00, y: 0.28, delay: 0.2 },
];

const SPARKLE_COUNT: Partial<Record<OrimRarity, number>> = {
  epic:      4,
  legendary: 6,
  mythic:    8,
};

const AURORA_INSET: Partial<Record<OrimRarity, number>> = {
  legendary: 5,
  mythic:    8,
};

const AURORA_OPACITY: Partial<Record<OrimRarity, number>> = {
  legendary: 0.70,
  mythic:    0.88,
};

const AURORA_DURATION: Partial<Record<OrimRarity, number>> = {
  legendary: 6,
  mythic:    3.5,
};

// ─── Halo star positions ───────────────────────────────────────────────────────
// Fractional coords relative to the card (0..1 = on card, outside = in halo).
// fx/fy are the center of each star. size in px, delay/dur in seconds.

interface StarDef {
  fx: number; fy: number;
  size: number; delay: number; dur: number;
  bright?: number; // 0 = pure rarity color, 1 = white blend
  onTop?: boolean; // render above the card face (z-index elevated)
}

// Offsets are halved vs v1: was ±0.30–0.42 out, now ±0.15–0.21.
// onTop marks ~15% of each set to render above the card z-level.

// 8 stars for legendary
const LEGENDARY_STARS: StarDef[] = [
  // top edge
  { fx: 0.18, fy: -0.20, size: 22, delay: 0.0, dur: 3.1, bright: 0.3 },
  { fx: 0.62, fy: -0.18, size: 18, delay: 1.4, dur: 2.8, onTop: true }, // 1 of 8 = 12.5 %
  { fx: 0.88, fy: -0.21, size: 20, delay: 0.7, dur: 3.4 },
  // right edge
  { fx: 1.19, fy: 0.22,  size: 19, delay: 1.0, dur: 2.6 },
  { fx: 1.17, fy: 0.68,  size: 24, delay: 0.3, dur: 3.2, bright: 0.2 },
  // bottom edge
  { fx: 0.72, fy: 1.19,  size: 19, delay: 1.7, dur: 2.9 },
  { fx: 0.28, fy: 1.17,  size: 18, delay: 0.9, dur: 3.0 },
  // left edge
  { fx: -0.18, fy: 0.42, size: 22, delay: 1.2, dur: 3.3, bright: 0.15 },
];

// 14 stars for mythic — legendary set + 6 more
const MYTHIC_STARS: StarDef[] = [
  ...LEGENDARY_STARS,
  // extra corners / further out (also halved from v1)
  { fx: -0.20, fy: 0.14,  size: 18, delay: 0.5, dur: 2.7 },
  { fx: -0.19, fy: 0.78,  size: 16, delay: 1.9, dur: 3.5 },
  { fx:  0.42, fy: -0.25, size: 17, delay: 2.2, dur: 2.5, bright: 0.4 },
  { fx:  1.21, fy: 0.46,  size: 20, delay: 0.6, dur: 3.0, onTop: true }, // 2nd onTop for mythic (2 of 14 = 14.3 %)
  { fx:  0.85, fy: 1.22,  size: 17, delay: 1.5, dur: 2.8 },
  { fx: -0.14, fy: 0.88,  size: 15, delay: 2.5, dur: 3.6 },
];

// ─── Keyframes ────────────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes rarity-shimmer {
  0%   { transform: translateX(-220%) skewX(-12deg); }
  100% { transform: translateX(520%) skewX(-12deg); }
}
@keyframes rarity-sparkle {
  0%, 100% { opacity: 0;   transform: rotate(45deg) scale(0.3); }
  45%       { opacity: 1;   transform: rotate(45deg) scale(1.3); }
  55%       { opacity: 0.9; transform: rotate(45deg) scale(1.1); }
}
@keyframes rarity-aurora {
  0%   { filter: blur(5px) hue-rotate(0deg)   brightness(1.05); }
  100% { filter: blur(5px) hue-rotate(360deg) brightness(1.15); }
}
@keyframes rarity-aurora-mythic {
  0%   { filter: blur(7px) hue-rotate(0deg)   brightness(1.1) saturate(1.4); }
  100% { filter: blur(7px) hue-rotate(360deg) brightness(1.3) saturate(1.8); }
}
@keyframes rarity-bloom {
  0%, 100% { opacity: 0.35; transform: scale(0.94); }
  50%       { opacity: 0.75; transform: scale(1.06); }
}
@keyframes rarity-star-float {
  0%   { transform: translateY(0px)  rotate(0deg)  scale(1);    opacity: 0.8; }
  50%  { transform: translateY(-10px) rotate(22deg) scale(1.3); opacity: 1;   }
  100% { transform: translateY(0px)  rotate(0deg)  scale(1);    opacity: 0.8; }
}
`;

// ─── Star SVG ──────────────────────────────────────────────────────────────────
// 4-pointed sparkle star (polygon), 10×10 viewBox centered at (5,5).
// Outer tips at cardinal points (radius 5), inner corners at ~1.1 units
// from center on the diagonals — gives a very spiky cross/lens-flare shape.
const STAR_PATH = 'M5,0 L5.8,4.2 L10,5 L5.8,5.8 L5,10 L4.2,5.8 L0,5 L4.2,4.2 Z';

// ─── Component ────────────────────────────────────────────────────────────────

interface RarityAuraProps {
  rarity: OrimRarity;
  cardWidth: number;
  cardHeight: number;
  /** 'behind' (default) = all layers except onTop stars.
   *  'front' = only onTop stars, intended to be rendered after the Card in the DOM. */
  layer?: 'behind' | 'front';
  /** Tilt intensity (0..1) from mouse interaction. */
  hyp?: number;
}

export const RarityAura = memo(function RarityAura({
  rarity,
  cardWidth,
  cardHeight,
  hyp,
  layer = 'behind',
}: RarityAuraProps) {
  hyp = hyp ?? 0;
  const intensity    = Math.min(1, Math.max(0, hyp));
  const rgb          = RARITY_RGB[rarity];
  const glowPx       = RARITY_GLOW_PX[rarity] + intensity * 8;
  const glowAlpha    = Math.min(1, RARITY_GLOW_ALPHA[rarity] * (0.8 + intensity * 0.4));
  const shimmerDur  = SHIMMER_DURATION[rarity];
  const shimmerOpac = SHIMMER_OPACITY[rarity];
  const sparkleN    = SPARKLE_COUNT[rarity] ?? 0;
  const auroraInset = AURORA_INSET[rarity];
  const baseAuroraOp = AURORA_OPACITY[rarity] ?? 0;
  const auroraOpac   = baseAuroraOp * (0.55 + intensity * 0.45);
  const auroraDur    = Math.max(2, (AURORA_DURATION[rarity] ?? 4) - intensity * 0.75);
  const isMythic    = rarity === 'mythic';
  const isLegendary = rarity === 'legendary' || isMythic;
  const br          = 10; // card border-radius (px)

  const allStarDefs = isMythic ? MYTHIC_STARS : isLegendary ? LEGENDARY_STARS : null;
  // front pass: only onTop stars; behind pass: everything else
  const starDefs = allStarDefs
    ? (layer === 'front'
        ? allStarDefs.filter(s => s.onTop)
        : allStarDefs.filter(s => !s.onTop))
    : null;

  // The front pass only renders stars — bail early for non-legendary
  if (layer === 'front') {
    if (!starDefs || starDefs.length === 0) return null;
    return (
      <>
        <style>{KEYFRAMES}</style>
        {starDefs.map(({ fx, fy, size, delay, dur, bright = 0 }, idx) => {
          const cx = fx * cardWidth;
          const cy = fy * cardHeight;
          const starColor = bright > 0 ? `rgba(${rgb}, ${1 - bright * 0.5})` : `rgba(${rgb}, 1)`;
          const glowColor = `rgba(${rgb}, 1)`;
          return (
            <svg
              key={`star-front-${idx}`}
              viewBox="0 0 10 10"
              width={size}
              height={size}
              className="absolute pointer-events-none"
              style={{
                left: cx - size / 2,
                top:  cy - size / 2,
                zIndex: 20,
                overflow: 'visible',
                filter: [
                  `drop-shadow(0 0 2px ${glowColor})`,
                  `drop-shadow(0 0 ${Math.round(size * 0.4)}px ${glowColor})`,
                  `drop-shadow(0 0 ${Math.round(size * 0.9)}px rgba(${rgb}, 0.5))`,
                ].join(' '),
                animation: `rarity-star-float ${dur}s ease-in-out infinite`,
                animationDelay: `${delay}s`,
                opacity: 0.75 + intensity * 0.2,
              }}
            >
              <path d={STAR_PATH} fill={starColor} />
              <circle cx="5" cy="5" r="1.6" fill="rgba(255,255,255,0.95)" />
            </svg>
          );
        })}
      </>
    );
  }

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* ── Layer −2: Mythic outer bloom ──────────────────────────── */}
      {isMythic && (
        <div
          className="absolute pointer-events-none"
          style={{
            inset: -18,
            borderRadius: br + 18,
            zIndex: -2,
            background: `radial-gradient(ellipse at center,
              rgba(${rgb}, 0.55) 0%,
              rgba(132, 104, 216, 0.35) 45%,
              transparent 72%)`,
            animation: 'rarity-bloom 3s ease-in-out infinite',
          }}
        />
      )}

      {/* ── Layer −1: Aurora border (legendary / mythic) ─────────── */}
      {isLegendary && auroraInset != null && (
        <div
          className="absolute pointer-events-none"
          style={{
            inset: -auroraInset,
            borderRadius: br + auroraInset,
            zIndex: -1,
            background: `linear-gradient(135deg,
              #ff6b6b, #ffd93d, #6bcb77,
              #4d96ff, #c77dff, #ff6b6b)`,
            opacity: auroraOpac,
            animation: `${isMythic ? 'rarity-aurora-mythic' : 'rarity-aurora'} ${auroraDur}s linear infinite`,
            filter: `brightness(${1 + intensity * 0.15})`,
          }}
        />
      )}

      {/* ── Layer 0: Outer glow ring (all rarities) ──────────────── */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: 0,
          borderRadius: br,
          zIndex: 0,
          boxShadow: [
            `0 0 ${glowPx}px rgba(${rgb}, ${glowAlpha})`,
            `0 0 ${glowPx * 1.8}px rgba(${rgb}, ${glowAlpha * 0.45})`,
            `0 0 ${glowPx * 2.8}px rgba(${rgb}, ${glowAlpha * 0.25})`,
          ].join(', '),
          filter: `brightness(${1 + intensity * 0.12})`,
        }}
      />

      {/* ── Layer 5: Shimmer sweep (uncommon+) ───────────────────── */}
      {shimmerDur != null && (
        <div
          className="absolute pointer-events-none overflow-hidden"
          style={{
            inset: 0,
            borderRadius: br,
            zIndex: 5,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-50%',
              left: 0,
              width: '30%',
              height: '200%',
              background: `linear-gradient(90deg,
                transparent,
                rgba(255, 255, 255, ${shimmerOpac}),
                transparent)`,
              animation: `rarity-shimmer ${shimmerDur}s ease-in-out infinite`,
            }}
          />
        </div>
      )}

      {/* ── Layer 6: Border sparkle dots (epic+) ─────────────────── */}
      {sparkleN > 0 &&
        SPARKLE_RING.slice(0, sparkleN).map(({ x, y, delay }, idx) => {
          const px = x * cardWidth;
          const py = y * cardHeight;
          const dur = 1.2 + (idx % 3) * 0.2;
          return (
            <div
              key={idx}
              className="absolute pointer-events-none"
              style={{
                width: 5,
                height: 5,
                left: px - 2.5,
                top:  py - 2.5,
                zIndex: 6,
                borderRadius: 1,
                backgroundColor: `rgba(${rgb}, 1)`,
                boxShadow: `0 0 5px 1px rgba(${rgb}, 0.85), 0 0 10px 2px rgba(${rgb}, 0.4)`,
                animation: `rarity-sparkle ${dur}s ease-in-out infinite`,
                animationDelay: `${delay}s`,
              }}
            />
          );
        })}

      {/* ── Layer 7: Floating star sparkles in halo (legendary+) ─── */}
      {starDefs != null &&
        starDefs.map(({ fx, fy, size, delay, dur, bright = 0, onTop = false }, idx) => {
          // Star center in px relative to the card's top-left corner
          const cx = fx * cardWidth;
          const cy = fy * cardHeight;

          // Blend rarity color toward white for "bright" stars
          const starColor = bright > 0
            ? `rgba(${rgb}, ${1 - bright * 0.5})`
            : `rgba(${rgb}, 1)`;
          const glowColor = `rgba(${rgb}, 1)`;

          return (
            <svg
              key={`star-${idx}`}
              viewBox="0 0 10 10"
              width={size}
              height={size}
              className="absolute pointer-events-none"
              style={{
                left: cx - size / 2,
                top:  cy - size / 2,
                zIndex: onTop ? 20 : 7,
                overflow: 'visible',
                filter: [
                  `drop-shadow(0 0 2px ${glowColor})`,
                  `drop-shadow(0 0 ${Math.round(size * 0.4)}px ${glowColor})`,
                  `drop-shadow(0 0 ${Math.round(size * 0.9)}px rgba(${rgb}, 0.5))`,
                ].join(' '),
                animation: `rarity-star-float ${dur}s ease-in-out infinite`,
                animationDelay: `${delay}s`,
                opacity: 0.45 + intensity * 0.35,
              }}
            >
              <path d={STAR_PATH} fill={starColor} />
              {/* bright white core at center so the star "pops" */}
              <circle cx="5" cy="5" r="1.6" fill="rgba(255,255,255,0.95)" />
            </svg>
          );
        })}
    </>
  );
});
