import { memo, useMemo } from 'react';
import type { BlockingRect } from '../engine/lighting';

export interface PoiStarDef {
  dx: number;
  dy: number;
  size: number;
  delay: number;
  dur: number;
}

export interface POISparkleEffectResult {
  proximity: number;
  activeStarCount: number;
  lights: Array<{
    x: number;
    y: number;
    radius: number;
    intensity: number;
    color: string;
    castShadows: boolean;
    flicker: { enabled: boolean; speed: number; amount: number };
  }>;
  shadowBlocker: BlockingRect | null;
  glowRadius: number;
  glowIntensity: number;
}

/**
 * Pure sparkle effect computation for a POI based on player proximity.
 */
export function computePOISparkleEffect({
  poiX,
  poiY,
  playerX,
  playerY,
  screenPos,
  proximityRange = 3,
  maxStarCount = 6,
  starDefs,
  glowColor = '#f7d24b',
}: {
  poiX: number;
  poiY: number;
  playerX: number;
  playerY: number;
  screenPos: { px: number; py: number } | null;
  proximityRange?: number;
  maxStarCount?: number;
  starDefs: PoiStarDef[];
  glowColor?: string;
}): POISparkleEffectResult {
  const dx = Math.abs(playerX - poiX);
  const dy = Math.abs(playerY - poiY);
  const dist = Math.max(dx, dy); // Chebyshev distance
  const proximity = dist > proximityRange ? 0 : 1 - dist / proximityRange;
  const activeStarCount = Math.round(proximity * maxStarCount);
  const glowRadius = 10 + proximity * 2;
  const glowIntensity = 0.9 + proximity * 1.1;

  const lights =
    !screenPos || activeStarCount === 0
      ? []
      : starDefs.slice(0, activeStarCount).map((star) => ({
        x: screenPos.px + star.dx,
        y: screenPos.py + star.dy,
        radius: glowRadius,
        intensity: glowIntensity,
        color: glowColor,
        castShadows: false,
        flicker: { enabled: true, speed: 0.4, amount: 0.08 },
      }));

  const shadowBlocker =
    !screenPos || activeStarCount === 0
      ? null
      : {
        x: screenPos.px - 8,
        y: screenPos.py - 8,
        width: 16,
        height: 16,
        castHeight: 4,
        softness: 2,
      };

  return {
    proximity,
    activeStarCount,
    lights,
    shadowBlocker,
    glowRadius,
    glowIntensity,
  };
}

/**
 * Calculate sparkle effect for a POI based on player proximity
 */
export function usePOISparkleEffect({
  poiX,
  poiY,
  playerX,
  playerY,
  screenPos,
  proximityRange = 3,
  maxStarCount = 6,
  starDefs,
  glowColor = '#f7d24b',
}: {
  poiX: number;
  poiY: number;
  playerX: number;
  playerY: number;
  screenPos: { px: number; py: number } | null;
  proximityRange?: number;
  maxStarCount?: number;
  starDefs: PoiStarDef[];
  glowColor?: string;
}): POISparkleEffectResult {
  const proximity = useMemo(() => {
    const dx = Math.abs(playerX - poiX);
    const dy = Math.abs(playerY - poiY);
    const dist = Math.max(dx, dy); // Chebyshev distance
    if (dist > proximityRange) return 0;
    return 1 - dist / proximityRange;
  }, [playerX, playerY, poiX, poiY, proximityRange]);

  const activeStarCount = Math.round(proximity * maxStarCount);
  const glowRadius = 10 + proximity * 2;
  const glowIntensity = 0.9 + proximity * 1.1;

  // Light sources at each sparkle position
  const lights = useMemo(() => {
    if (!screenPos || activeStarCount === 0) return [];
    return starDefs.slice(0, activeStarCount).map((star) => ({
      x: screenPos.px + star.dx,
      y: screenPos.py + star.dy,
      radius: glowRadius,
      intensity: glowIntensity,
      color: glowColor,
      castShadows: false,
      flicker: { enabled: true, speed: 0.4, amount: 0.08 },
    }));
  }, [screenPos, activeStarCount, glowRadius, glowIntensity, glowColor, starDefs]);

  // Shadow blocker at POI center
  const shadowBlocker = useMemo(() => {
    if (!screenPos || activeStarCount === 0) return null;
    return {
      x: screenPos.px - 8,
      y: screenPos.py - 8,
      width: 16,
      height: 16,
      castHeight: 4,
      softness: 2,
    };
  }, [screenPos, activeStarCount]);

  return {
    proximity,
    activeStarCount,
    lights,
    shadowBlocker,
    glowRadius,
    glowIntensity,
  };
}

interface POISparkleMarkerProps {
  screenPos: { px: number; py: number } | null;
  activeStarCount: number;
  starDefs: PoiStarDef[];
  starPath: string;
}

const STAR_PATH_DEFAULT = 'M5,0 L5.8,4.2 L10,5 L5.8,5.8 L5,10 L4.2,5.8 L0,5 L4.2,4.2 Z';

/**
 * Visual component that renders sparkle stars around a POI
 */
export const POISparkleMarker = memo(function POISparkleMarker({
  screenPos,
  activeStarCount,
  starDefs,
  starPath = STAR_PATH_DEFAULT,
}: POISparkleMarkerProps) {
  if (!screenPos || activeStarCount === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 9 }}
    >
      <style>{`
        @keyframes rarity-star-float {
          0%   { transform: translateY(0px)  rotate(0deg)  scale(1);   opacity: 0.8; }
          50%  { transform: translateY(-6px) rotate(22deg) scale(1.3); opacity: 1;   }
          100% { transform: translateY(0px)  rotate(0deg)  scale(1);   opacity: 0.8; }
        }
      `}</style>
      {starDefs.slice(0, activeStarCount).map((star, i) => {
        const sx = screenPos.px + star.dx;
        const sy = screenPos.py + star.dy;
        return (
          <div
            key={`poi-star-${i}`}
            style={{
              position: 'absolute',
              left: sx - star.size / 2,
              top: sy - star.size / 2,
              width: star.size,
              height: star.size,
              animation: `rarity-star-float ${star.dur}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
              filter: `drop-shadow(0 0 2px rgba(247,210,75,1)) drop-shadow(0 0 ${Math.round(star.size * 0.8)}px rgba(247,210,75,0.6))`,
            }}
          >
            <svg viewBox="0 0 10 10" width={star.size} height={star.size} style={{ display: 'block' }}>
              <path d={starPath} fill="rgba(247,210,75,1)" />
              <circle cx="5" cy="5" r="1.6" fill="rgba(255,255,255,0.95)" />
            </svg>
          </div>
        );
      })}
    </div>
  );
});
