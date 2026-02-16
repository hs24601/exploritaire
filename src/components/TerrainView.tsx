/**
 * TerrainView — Path A (CSS/SVG)
 *
 * Over-the-shoulder terrain backdrop for the RPG exploration mode.
 * Renders behind all game UI (tableaus, minimap, HUD).
 *
 * Activation: ?terrain=1 in the URL. Zero impact on gameplay when absent.
 *
 * For the WebGL/Pixi.js upgrade path (terrain=2), see docs/terrain-path-b.md.
 */

import { memo, useMemo, useRef, useEffect, useState } from 'react';
import type { Direction } from './Compass';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TerrainViewProps {
  /** Current biome key — drives color palette and object type. */
  biome: string | undefined;
  /** Player's facing direction — the view renders what's ahead. */
  facing: Direction;
  /**
   * Step progress 0.0–1.0: fraction of travel threshold completed toward
   * the next grid step. Drives the near-layer parallax creep.
   */
  stepProgress: number;
  /**
   * Increments by 1 each time the player takes a full grid step.
   * Triggers the scroll-through animation.
   */
  stepCount: number;
  /**
   * Current map node grid coordinates. Used to seed the terrain object
   * placement so the same node always shows the same trees/terrain.
   */
  nodeX: number;
  nodeY: number;
  /**
   * Which layers to render.
   * - 'background': sky, ground, terrain objects, fog — no party figures.
   * - 'party': party silhouettes + ground shadow only — transparent background.
   * - 'all' (default): everything.
   */
  layer?: 'all' | 'background' | 'party';
}

// ---------------------------------------------------------------------------
// Biome palette / terrain config
// ---------------------------------------------------------------------------

interface BiomeConfig {
  skyTop: string;
  skyBottom: string;
  groundColor: string;
  midColor: string;
  objectType: 'tree' | 'peak' | 'dune' | 'pillar' | 'grass';
  fogColor: string;
  /** Shaft color for SVG light rays. null disables shafts (e.g. dungeon). */
  shaftColor: string | null;
}

const BIOME_CONFIGS: Record<string, BiomeConfig> = {
  forest: {
    skyTop: '#1a4a30',
    skyBottom: '#2e8a52',
    groundColor: '#14320e',
    midColor: '#1e4c18',
    objectType: 'tree',
    fogColor: 'rgba(30, 110, 60, 0.45)',
    shaftColor: '#c8e878',   // green-gold forest dapple
  },
  mountain: {
    skyTop: '#1e3555',
    skyBottom: '#3a6a9a',
    groundColor: '#22222e',
    midColor: '#2e2e48',
    objectType: 'peak',
    fogColor: 'rgba(80, 120, 175, 0.4)',
    shaftColor: '#b8d8f8',   // ice-blue alpine shafts between peaks
  },
  desert: {
    skyTop: '#5a3a10',
    skyBottom: '#b87828',
    groundColor: '#5e3a0a',
    midColor: '#7a4e14',
    objectType: 'dune',
    fogColor: 'rgba(200, 140, 50, 0.35)',
    shaftColor: '#ffe080',   // harsh amber heat rays
  },
  dungeon: {
    skyTop: '#0e0820',
    skyBottom: '#281450',
    groundColor: '#100c1e',
    midColor: '#1a1034',
    objectType: 'pillar',
    fogColor: 'rgba(60, 25, 110, 0.6)',
    shaftColor: null,        // no light source underground
  },
  plains: {
    skyTop: '#1a3460',
    skyBottom: '#2e5ea0',
    groundColor: '#163010',
    midColor: '#1e4018',
    objectType: 'grass',
    fogColor: 'rgba(40, 100, 80, 0.3)',
    shaftColor: '#d8f0a0',   // soft daylight shafts
  },
};

const DEFAULT_BIOME: BiomeConfig = BIOME_CONFIGS.forest;

// ---------------------------------------------------------------------------
// Terrain object generators (SVG paths)
// TODO: Replace with richer art-directed SVG shapes in Path A development.
// ---------------------------------------------------------------------------

function TreeSilhouette({ x, scale, opacity }: { x: number; scale: number; opacity: number }) {
  const h = 72 * scale;
  const trunk = 3 * scale;
  const trunkH = h * 0.15;

  // Each tier: [tipOffsetX, topY, halfWidth, tierHeight, leftDroop, rightDroop, color]
  // Drooping branch tips give an organic pine silhouette rather than a flat triangle.
  // Slight tip offsets and asymmetric droop break the flash-cartoon look.
  const tiers: Array<[number, number, number, number, number, number, string]> = [
    //  tipX   topY   w      tH     lDroop rDroop  fill
    [  0.5,   0,     6,     22,    1.5,   1.0,   'rgba(16, 56, 20, 0.94)' ],  // apex
    [ -0.5,   8,     9,     23,    2.0,   2.5,   'rgba(13, 50, 17, 0.95)' ],
    [  1.0,  17,    13,     24,    3.0,   2.0,   'rgba(11, 44, 15, 0.96)' ],
    [ -0.8,  27,    17,     25,    3.5,   4.0,   'rgba(9,  38, 13, 0.97)' ],
    [  0.5,  37,    21,     26,    4.5,   3.5,   'rgba(7,  33, 11, 0.98)' ],
    [ -1.0,  48,    25,     26,    5.0,   5.5,   'rgba(5,  27,  9, 1.0 )' ],  // base
  ].map(([tx, ty, w, th, ld, rd, c]) => [
    (tx as number) * scale,
    (ty as number) * scale,
    (w  as number) * scale,
    (th as number) * scale,
    (ld as number) * scale,
    (rd as number) * scale,
    c as string,
  ]) as Array<[number, number, number, number, number, number, string]>;

  return (
    <g transform={`translate(${x}, ${100 - h})`} opacity={opacity}>
      {/* Trunk */}
      <rect x={-trunk / 2} y={h - trunkH} width={trunk} height={trunkH} fill="rgba(28, 18, 8, 0.95)" />
      {/* Tiers rendered back-to-front (bottom first so upper tiers overlap lower) */}
      {[...tiers].reverse().map(([tx, ty, w, th, ld, rd, fill], i) => (
        <polygon
          key={i}
          fill={fill}
          points={[
            `${tx},${ty}`,                    // tip (slightly offset)
            `${tx - w * 0.72},${ty + th * 0.68}`, // left shoulder
            `${tx - w},${ty + th - ld}`,      // left branch tip (drooped)
            `${tx},${ty + th}`,               // centre base
            `${tx + w},${ty + th - rd}`,      // right branch tip (drooped)
            `${tx + w * 0.72},${ty + th * 0.68}`, // right shoulder
          ].join(' ')}
        />
      ))}
    </g>
  );
}

function PeakSilhouette({ x, scale, opacity }: { x: number; scale: number; opacity: number }) {
  const h = 70 * scale;
  const w = 40 * scale;
  return (
    <g transform={`translate(${x}, ${100 - h})`} opacity={opacity}>
      <polygon
        points={`0,0 ${-w},${h} ${w},${h}`}
        fill="rgba(35, 38, 55, 0.95)"
      />
      {/* Snow cap */}
      <polygon
        points={`0,0 ${-w * 0.22},${h * 0.28} ${w * 0.22},${h * 0.28}`}
        fill="rgba(200, 210, 220, 0.7)"
      />
    </g>
  );
}

function DuneSilhouette({ x, scale, opacity }: { x: number; scale: number; opacity: number }) {
  const h = 35 * scale;
  const w = 55 * scale;
  return (
    <g transform={`translate(${x}, ${100 - h})`} opacity={opacity}>
      <ellipse cx={0} cy={h} rx={w} ry={h * 0.6} fill="rgba(80, 60, 20, 0.85)" />
    </g>
  );
}

function PillarSilhouette({ x, scale, opacity }: { x: number; scale: number; opacity: number }) {
  const h = 65 * scale;
  const w = 10 * scale;
  return (
    <g transform={`translate(${x}, ${100 - h})`} opacity={opacity}>
      <rect x={-w / 2} y={0} width={w} height={h} fill="rgba(20, 15, 35, 0.95)" />
      {/* Capital */}
      <rect x={-w * 0.8} y={0} width={w * 1.6} height={h * 0.06} fill="rgba(40, 30, 60, 0.9)" />
    </g>
  );
}

function GrassTuft({ x, scale, opacity }: { x: number; scale: number; opacity: number }) {
  const h = 18 * scale;
  return (
    <g transform={`translate(${x}, ${100 - h})`} opacity={opacity}>
      <line x1={0} y1={h} x2={-4 * scale} y2={0} stroke="rgba(30, 55, 20, 0.85)" strokeWidth={1.5 * scale} />
      <line x1={0} y1={h} x2={0} y2={0} stroke="rgba(35, 60, 22, 0.9)" strokeWidth={1.5 * scale} />
      <line x1={0} y1={h} x2={4 * scale} y2={0} stroke="rgba(28, 52, 18, 0.8)" strokeWidth={1.5 * scale} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Object placement seeds — deterministic per position so terrain is stable
// TODO: Tie to actual map node data (biome regions, POI proximity) in Path A dev.
// ---------------------------------------------------------------------------

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

interface TerrainObject {
  x: number;       // 0–100 (% of view width)
  scale: number;
  opacity: number;
  layer: 'far' | 'mid' | 'near';
}

function generateTerrainObjects(nodeX: number, nodeY: number, type: BiomeConfig['objectType']): TerrainObject[] {
  // Seed from node grid coordinates so terrain is stable when revisiting a location.
  // The XOR of two large primes produces good bit distribution across the integer grid.
  const nodeSeed = (Math.imul(nodeX, 73856093) ^ Math.imul(nodeY, 19349663)) >>> 0;
  const rand = seededRandom(nodeSeed + type.charCodeAt(0));
  const objects: TerrainObject[] = [];

  const counts = { far: 5, mid: 4, near: 3 };

  (['far', 'mid', 'near'] as const).forEach((layer) => {
    for (let i = 0; i < counts[layer]; i += 1) {
      objects.push({
        x: rand() * 100,
        scale: layer === 'far' ? 0.45 + rand() * 0.2
          : layer === 'mid' ? 0.7 + rand() * 0.25
          : 1.0 + rand() * 0.35,
        opacity: layer === 'far' ? 0.4 + rand() * 0.3
          : layer === 'mid' ? 0.6 + rand() * 0.25
          : 0.8 + rand() * 0.2,
        layer,
      });
    }
  });

  return objects.sort((a, b) => {
    const order = { far: 0, mid: 1, near: 2 };
    return order[a.layer] - order[b.layer];
  });
}

function TerrainObject({ obj, type, viewWidth }: {
  obj: TerrainObject;
  type: BiomeConfig['objectType'];
  viewWidth: number;
}) {
  const px = (obj.x / 100) * viewWidth;
  const props = { x: px, scale: obj.scale, opacity: obj.opacity };
  switch (type) {
    case 'tree':   return <TreeSilhouette {...props} />;
    case 'peak':   return <PeakSilhouette {...props} />;
    case 'dune':   return <DuneSilhouette {...props} />;
    case 'pillar': return <PillarSilhouette {...props} />;
    case 'grass':  return <GrassTuft {...props} />;
    default:       return null;
  }
}

// ---------------------------------------------------------------------------
// Party silhouettes
// TODO: Replace with per-character silhouette art when available.
// ---------------------------------------------------------------------------

function PartySilhouettes({ viewWidth }: { viewWidth: number }) {
  const cx = viewWidth / 2;
  // Three figures: left (Fox), center (Wolf), right (Owl)
  const positions = [cx - 52, cx, cx + 52];
  const scales = [0.82, 1.0, 0.82];
  const opacities = [0.72, 0.88, 0.72];

  return (
    <g>
      {positions.map((px, i) => {
        const s = scales[i];
        const op = opacities[i];
        const h = 58 * s;
        const sh = 14 * s; // shoulder width half
        const hw = 7 * s;  // hip width half
        return (
          <g key={i} transform={`translate(${px}, 0)`} opacity={op}>
            {/* Rim-light outline for contrast against dark biome sky */}
            <path
              d={`M${-hw},100 L${-sh},${100 - h * 0.55} L${-sh * 0.6},${100 - h * 0.78} L${sh * 0.6},${100 - h * 0.78} L${sh},${100 - h * 0.55} L${hw},100 Z`}
              fill="none"
              stroke="rgba(180, 200, 220, 0.25)"
              strokeWidth={1.2 * s}
            />
            {/* Body */}
            <path
              d={`M${-hw},100 L${-sh},${100 - h * 0.55} L${-sh * 0.6},${100 - h * 0.78} L${sh * 0.6},${100 - h * 0.78} L${sh},${100 - h * 0.55} L${hw},100 Z`}
              fill="rgba(18, 22, 28, 0.96)"
            />
            {/* Head */}
            <ellipse
              cx={0}
              cy={100 - h * 0.88}
              rx={sh * 0.55}
              ry={sh * 0.62}
              fill="rgba(18, 22, 28, 0.96)"
              stroke="rgba(180, 200, 220, 0.25)"
              strokeWidth={1.2 * s}
            />
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Direction → parallax sign
// E/NE/SE: terrain drifts left (-1). W/NW/SW: drifts right (+1). N/S: -1.
// ---------------------------------------------------------------------------

function dirSign(facing: Direction): 1 | -1 {
  return (facing === 'W' || facing === 'NW' || facing === 'SW') ? 1 : -1;
}

export const TerrainView = memo(function TerrainView({
  biome,
  facing,
  stepProgress,
  stepCount,
  nodeX,
  nodeY,
  layer = 'all',
}: TerrainViewProps) {
  const config = (biome && BIOME_CONFIGS[biome]) ?? DEFAULT_BIOME;

  // ── ResizeObserver: measure real container width ──────────────────────────
  const bgDivRef = useRef<HTMLDivElement | null>(null);
  const [viewWidth, setViewWidth] = useState(400);

  useEffect(() => {
    const el = bgDivRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setViewWidth(Math.round(w));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Terrain objects regenerate when the node changes ─────────────────────
  const objects = useMemo(
    () => generateTerrainObjects(nodeX, nodeY, config.objectType),
    [nodeX, nodeY, config.objectType],
  );

  // ── Animated scroll on step: 350ms ease-out cubic ────────────────────────
  const animRef = useRef<number | null>(null);
  const prevStepCountRef = useRef(stepCount);
  const [scrollOffsets, setScrollOffsets] = useState({ near: 0, mid: 0 });

  useEffect(() => {
    if (stepCount === prevStepCountRef.current) return;
    prevStepCountRef.current = stepCount;

    const sign = dirSign(facing);
    const startNear = sign * 32;
    const startMid  = sign * 15;
    const duration  = 350;
    const t0 = performance.now();

    if (animRef.current !== null) cancelAnimationFrame(animRef.current);

    function tick(now: number) {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setScrollOffsets({
        near: startNear * (1 - ease),
        mid:  startMid  * (1 - ease),
      });
      if (p < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    }
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [stepCount, facing]);

  // ── Combined offsets: step-progress creep + scroll animation ─────────────
  const sign = dirSign(facing);
  const nearOffset = (stepProgress * -18 * sign) + scrollOffsets.near;
  const midOffset  = (stepProgress *  -8 * sign) + scrollOffsets.mid;
  // Far layer intentionally static — distant terrain barely moves

  return (
    <>
      {/* Background layer: sky + ground + terrain objects (z=0, behind all UI) */}
      {layer !== 'party' && (
        <div
          ref={bgDivRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${viewWidth} 100`}
            preserveAspectRatio="xMidYMid slice"
            style={{ display: 'block' }}
          >
            <defs>
              <linearGradient id="tv-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.skyTop} />
                <stop offset="100%" stopColor={config.skyBottom} />
              </linearGradient>
              <linearGradient id="tv-fog" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.fogColor} stopOpacity={0} />
                <stop offset="75%" stopColor={config.fogColor} stopOpacity={1} />
                <stop offset="100%" stopColor={config.fogColor} stopOpacity={0} />
              </linearGradient>
              {/* Light shaft gradient: bright near the sun, fading toward the ground */}
              {config.shaftColor && (
                <linearGradient id="tv-shaft" x1="0" y1="5" x2="0" y2="100"
                  gradientUnits="userSpaceOnUse">
                  <stop offset="0%"   stopColor={config.shaftColor} stopOpacity={0.55} />
                  <stop offset="35%"  stopColor={config.shaftColor} stopOpacity={0.90} />
                  <stop offset="80%"  stopColor={config.shaftColor} stopOpacity={0.20} />
                  <stop offset="100%" stopColor={config.shaftColor} stopOpacity={0} />
                </linearGradient>
              )}
              {/* Soft blur for shaft edges — applied as a group filter */}
              <filter id="tv-shaft-blur" x="-25%" y="-5%" width="150%" height="115%"
                colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
              </filter>
            </defs>

            {/* Sky — fills down to the ground line */}
            <rect x={0} y={0} width={viewWidth} height={83} fill="url(#tv-sky)" />

            {/* Ground — occupies bottom ~22% of viewport */}
            <rect x={0} y={78} width={viewWidth} height={22} fill={config.groundColor} />

            {/* Mid-ground band */}
            <rect x={0} y={73} width={viewWidth} height={10} fill={config.midColor} opacity={0.8} />

            {/* Far terrain objects (barely move) */}
            <g>
              {objects.filter(o => o.layer === 'far').map((obj, i) => (
                <TerrainObject key={i} obj={obj} type={config.objectType} viewWidth={viewWidth} />
              ))}
            </g>

            {/* Fog layer */}
            <rect x={0} y={0} width={viewWidth} height={100} fill="url(#tv-fog)" />

            {/* Mid terrain objects + light shafts through gaps */}
            <g transform={`translate(${midOffset}, 0)`}>
              {/* Light shafts — rendered first so mid objects occlude them */}
              {config.shaftColor && (() => {
                // Sun position in this group's local coordinate space.
                // Screen x=viewWidth/2 maps to local x = viewWidth/2 - midOffset.
                const sunLX = viewWidth / 2 - midOffset;
                const sunY  = 5;
                const groundY = 100;

                // Find gaps between adjacent mid-layer objects (sorted by x).
                const xs = objects
                  .filter(o => o.layer === 'mid')
                  .map(o => (o.x / 100) * viewWidth)
                  .sort((a, b) => a - b);

                // Virtual sentinels at the margins so edge gaps also produce shafts.
                const extended = [-viewWidth * 0.12, ...xs, viewWidth * 1.12];

                const shafts: Array<{ cx: number; hw: number; alpha: number }> = [];
                for (let i = 0; i < extended.length - 1; i++) {
                  const gap = extended[i + 1] - extended[i];
                  if (gap < 18) continue;   // trees too close — no visible gap
                  const cx   = (extended[i] + extended[i + 1]) / 2;
                  const hw   = Math.min(gap * 0.20, 9);
                  const alpha = Math.min(0.13, 0.04 + (gap / 110) * 0.09);
                  shafts.push({ cx, hw, alpha });
                }

                return (
                  <g filter="url(#tv-shaft-blur)"
                    style={{ mixBlendMode: 'screen' as const }}>
                    {shafts.map((s, i) => (
                      <polygon
                        key={i}
                        fill="url(#tv-shaft)"
                        fillOpacity={s.alpha}
                        points={[
                          `${sunLX - 0.7},${sunY}`,
                          `${s.cx - s.hw},${groundY}`,
                          `${s.cx + s.hw},${groundY}`,
                          `${sunLX + 0.7},${sunY}`,
                        ].join(' ')}
                      />
                    ))}
                  </g>
                );
              })()}
              {objects.filter(o => o.layer === 'mid').map((obj, i) => (
                <TerrainObject key={i} obj={obj} type={config.objectType} viewWidth={viewWidth} />
              ))}
            </g>

            {/* Near terrain objects */}
            <g transform={`translate(${nearOffset}, 0)`}>
              {objects.filter(o => o.layer === 'near').map((obj, i) => (
                <TerrainObject key={i} obj={obj} type={config.objectType} viewWidth={viewWidth} />
              ))}
            </g>
          </svg>
        </div>
      )}

      {/* Party layer: silhouettes + shadow (z=10100, above all tableaus and modals) */}
      {layer !== 'background' && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '25%',
            zIndex: 10100,
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${viewWidth} 100`}
            preserveAspectRatio="xMidYMax meet"
            style={{ display: 'block' }}
          >
            {/* Ground shadow under party */}
            <ellipse cx={viewWidth / 2} cy={97} rx={72} ry={5} fill="rgba(0,0,0,0.55)" />

            {/* Party silhouettes — always fixed, world moves past them */}
            <PartySilhouettes viewWidth={viewWidth} />
          </svg>
        </div>
      )}
    </>
  );
});
