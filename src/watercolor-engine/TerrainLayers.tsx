/**
 * TerrainLayers — Path B WebGL terrain rendering
 *
 * A @pixi/react component rendered inside the existing WatercolorCanvas
 * Pixi.js Application. Terrain layers sit below the watercolor paint layers
 * so watercolor splashes paint over the landscape.
 *
 * Activated when TerrainState.enabled is true (terrain=2 URL param).
 *
 * Design notes
 * ─────────────
 * - Five Pixi.js Graphics objects: bg, far, mid, near, sil (silhouettes).
 * - Static geometry is redrawn imperatively (via refs in useTick) only when
 *   nodeX/nodeY/biome changes — never every frame.
 * - Parallax is applied by mutating .x on the mid/near Graphics objects each
 *   tick — no geometry redraw needed.
 * - draw={() => {}} with useCallback ensures @pixi/react never auto-clears
 *   our imperatively-drawn content on React re-renders.
 */

import { useRef, useCallback } from 'react';
import { useTick } from '@pixi/react';
import type { Graphics } from 'pixi.js';
import { useTerrainState } from './WatercolorContext';

// ---------------------------------------------------------------------------
// Biome configs (mirroring TerrainView.tsx BIOME_CONFIGS)
// ---------------------------------------------------------------------------

interface BiomeColors {
  skyTopHex: number;
  skyBotHex: number;
  groundHex: number;
  midHex: number;
  midAlpha: number;
  fogHex: number;
  fogAlpha: number;
}

const BIOME_COLORS: Record<string, BiomeColors> = {
  forest:   { skyTopHex: 0x1a4a30, skyBotHex: 0x2e8a52, groundHex: 0x14320e, midHex: 0x1e4c18, midAlpha: 0.80, fogHex: 0x1e6e3c, fogAlpha: 0.45 },
  mountain: { skyTopHex: 0x1e3555, skyBotHex: 0x3a6a9a, groundHex: 0x22222e, midHex: 0x2e2e48, midAlpha: 0.80, fogHex: 0x5078af, fogAlpha: 0.40 },
  desert:   { skyTopHex: 0x5a3a10, skyBotHex: 0xb87828, groundHex: 0x5e3a0a, midHex: 0x7a4e14, midAlpha: 0.80, fogHex: 0xc88c32, fogAlpha: 0.35 },
  dungeon:  { skyTopHex: 0x0e0820, skyBotHex: 0x281450, groundHex: 0x100c1e, midHex: 0x1a1034, midAlpha: 0.80, fogHex: 0x3c196e, fogAlpha: 0.60 },
  plains:   { skyTopHex: 0x1a3460, skyBotHex: 0x2e5ea0, groundHex: 0x163010, midHex: 0x1e4018, midAlpha: 0.80, fogHex: 0x286450, fogAlpha: 0.30 },
};

type ObjectType = 'tree' | 'peak' | 'dune' | 'pillar' | 'grass';

const BIOME_OBJECT_TYPE: Record<string, ObjectType> = {
  forest: 'tree', mountain: 'peak', desert: 'dune', dungeon: 'pillar', plains: 'grass',
};

// ---------------------------------------------------------------------------
// Terrain object data
// ---------------------------------------------------------------------------

interface TerrainObject {
  x: number;       // 0–100 fraction of canvas width
  scale: number;
  opacity: number;
  layer: 'far' | 'mid' | 'near';
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateObjects(nodeX: number, nodeY: number, type: ObjectType): TerrainObject[] {
  const nodeSeed = (Math.imul(nodeX, 73856093) ^ Math.imul(nodeY, 19349663)) >>> 0;
  const rand = seededRandom(nodeSeed + type.charCodeAt(0));
  const objects: TerrainObject[] = [];
  const counts = { far: 5, mid: 4, near: 3 };
  (['far', 'mid', 'near'] as const).forEach((layer) => {
    for (let i = 0; i < counts[layer]; i++) {
      objects.push({
        x: rand() * 100,
        scale: layer === 'far' ? 0.45 + rand() * 0.20
             : layer === 'mid' ? 0.70 + rand() * 0.25
             : 1.00 + rand() * 0.35,
        opacity: layer === 'far' ? 0.4 + rand() * 0.30
               : layer === 'mid' ? 0.6 + rand() * 0.25
               : 0.8 + rand() * 0.20,
        layer,
      });
    }
  });
  return objects.sort((a, b) =>
    ({ far: 0, mid: 1, near: 2 }[a.layer]) - ({ far: 0, mid: 1, near: 2 }[b.layer])
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRgba(rgba: string): { color: number; alpha: number } {
  const m = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return { color: 0x000000, alpha: 1 };
  const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
  return { color: (r << 16) | (g << 8) | b, alpha: m[4] !== undefined ? parseFloat(m[4]) : 1 };
}

/** E/NE/SE/N/S scroll left (-1).  W/NW/SW scroll right (+1). */
function dirSign(facing: string): 1 | -1 {
  return (facing === 'W' || facing === 'NW' || facing === 'SW') ? 1 : -1;
}

// ---------------------------------------------------------------------------
// Drawing helpers — all coordinates in canvas pixels
// ---------------------------------------------------------------------------

/** Sky gradient using 16 horizontal strips (no native gradient in Pixi Graphics). */
function drawSky(g: Graphics, w: number, h: number, topHex: number, botHex: number) {
  const skyH = 0.83 * h;
  const strips = 16;
  const stripH = skyH / strips;
  const r1 = (topHex >> 16) & 0xff, g1 = (topHex >> 8) & 0xff, b1 = topHex & 0xff;
  const r2 = (botHex >> 16) & 0xff, g2 = (botHex >> 8) & 0xff, b2 = botHex & 0xff;
  for (let i = 0; i < strips; i++) {
    const t = (i + 0.5) / strips;
    const r = Math.round(r1 + (r2 - r1) * t);
    const gv = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    g.setFillStyle({ color: (r << 16) | (gv << 8) | b, alpha: 1 });
    g.rect(0, i * stripH, w, stripH + 1); // +1px to avoid seams
    g.fill();
  }
}

/** Fog band using 12 strips (mimics SVG linearGradient: peak density at 75%). */
function drawFog(g: Graphics, w: number, h: number, fogHex: number, fogAlpha: number) {
  const strips = 12;
  for (let i = 0; i < strips; i++) {
    const t = i / strips;
    const a = t < 0.75 ? (t / 0.75) * fogAlpha : ((1 - t) / 0.25) * fogAlpha;
    g.setFillStyle({ color: fogHex, alpha: a });
    g.rect(0, t * h, w, h / strips + 1);
    g.fill();
  }
}

/** sy = height / 100 — converts SVG 0-100 y-units to pixels. */

function drawTree(g: Graphics, px: number, scale: number, opacity: number, sy: number) {
  const tH = 72 * scale;
  const trunk = 3 * scale;
  const trunkH = tH * 0.15;
  const originY = (100 - tH) * sy;

  // Trunk
  g.setFillStyle({ color: 0x1c1208, alpha: 0.95 * opacity });
  g.rect(px - (trunk / 2) * sy, originY + (tH - trunkH) * sy, trunk * sy, trunkH * sy);
  g.fill();

  // Tiers: [tipOffsetX, topY, halfWidth, tierHeight, leftDroop, rightDroop, fill]
  const tiers: Array<[number, number, number, number, number, number, string]> = [
    [  0.5,   0,     6,     22,    1.5,   1.0,   'rgba(16, 56, 20, 0.94)' ],
    [ -0.5,   8,     9,     23,    2.0,   2.5,   'rgba(13, 50, 17, 0.95)' ],
    [  1.0,  17,    13,     24,    3.0,   2.0,   'rgba(11, 44, 15, 0.96)' ],
    [ -0.8,  27,    17,     25,    3.5,   4.0,   'rgba(9,  38, 13, 0.97)' ],
    [  0.5,  37,    21,     26,    4.5,   3.5,   'rgba(7,  33, 11, 0.98)' ],
    [ -1.0,  48,    25,     26,    5.0,   5.5,   'rgba(5,  27,  9, 1.0 )' ],
  ].map(([tx, ty, w, th, ld, rd, c]) => [
    (tx as number) * scale, (ty as number) * scale,
    (w  as number) * scale, (th as number) * scale,
    (ld as number) * scale, (rd as number) * scale,
    c as string,
  ]) as Array<[number, number, number, number, number, number, string]>;

  // Bottom tier rendered first so upper tiers overlap it
  [...tiers].reverse().forEach(([tx, ty, tw, th, ld, rd, fill]) => {
    const { color, alpha } = parseRgba(fill);
    g.setFillStyle({ color, alpha: alpha * opacity });
    const ox = px, oy = originY;
    g.moveTo(ox + tx * sy,                         oy + ty * sy);
    g.lineTo(ox + (tx - tw * 0.72) * sy,           oy + (ty + th * 0.68) * sy);
    g.lineTo(ox + (tx - tw) * sy,                  oy + (ty + th - ld) * sy);
    g.lineTo(ox + tx * sy,                         oy + (ty + th) * sy);
    g.lineTo(ox + (tx + tw) * sy,                  oy + (ty + th - rd) * sy);
    g.lineTo(ox + (tx + tw * 0.72) * sy,           oy + (ty + th * 0.68) * sy);
    g.closePath();
    g.fill();
  });
}

function drawPeak(g: Graphics, px: number, scale: number, opacity: number, sy: number) {
  const pH = 70 * scale;
  const pW = 40 * scale;
  const originY = (100 - pH) * sy;
  g.setFillStyle({ color: 0x232637, alpha: 0.95 * opacity });
  g.moveTo(px, originY);
  g.lineTo(px - pW * sy, originY + pH * sy);
  g.lineTo(px + pW * sy, originY + pH * sy);
  g.closePath();
  g.fill();
  // Snow cap
  g.setFillStyle({ color: 0xc8d2dc, alpha: 0.7 * opacity });
  g.moveTo(px, originY);
  g.lineTo(px - pW * 0.22 * sy, originY + pH * 0.28 * sy);
  g.lineTo(px + pW * 0.22 * sy, originY + pH * 0.28 * sy);
  g.closePath();
  g.fill();
}

function drawDune(g: Graphics, px: number, scale: number, opacity: number, h: number, sy: number) {
  const dH = 35 * scale;
  const dW = 55 * scale;
  // SVG: ellipse center = (px, 100) in SVG coords → (px, h) in pixels
  g.setFillStyle({ color: 0x503c14, alpha: 0.85 * opacity });
  g.ellipse(px, h, dW * sy, dH * 0.6 * sy);
  g.fill();
}

function drawPillar(g: Graphics, px: number, scale: number, opacity: number, sy: number) {
  const pH = 65 * scale;
  const pW = 10 * scale;
  const originY = (100 - pH) * sy;
  g.setFillStyle({ color: 0x140f23, alpha: 0.95 * opacity });
  g.rect(px - (pW / 2) * sy, originY, pW * sy, pH * sy);
  g.fill();
  g.setFillStyle({ color: 0x281e3c, alpha: 0.9 * opacity });
  g.rect(px - pW * 0.8 * sy, originY, pW * 1.6 * sy, pH * 0.06 * sy);
  g.fill();
}

function drawGrass(g: Graphics, px: number, scale: number, opacity: number, sy: number) {
  const gH = 18 * scale;
  const originY = (100 - gH) * sy;
  const sw = 1.5 * scale * sy;
  [
    { dx: -4 * scale * sy, color: 0x1e3714, alpha: 0.85 },
    { dx: 0,               color: 0x233c16, alpha: 0.90 },
    { dx:  4 * scale * sy, color: 0x1c3412, alpha: 0.80 },
  ].forEach(({ dx, color, alpha }) => {
    g.setStrokeStyle({ color, alpha: alpha * opacity, width: sw });
    g.moveTo(px, originY + gH * sy);
    g.lineTo(px + dx, originY);
    g.stroke();
  });
}

function drawObject(
  g: Graphics, obj: TerrainObject, type: ObjectType,
  canvasW: number, canvasH: number, sy: number,
) {
  const px = (obj.x / 100) * canvasW;
  switch (type) {
    case 'tree':   drawTree(g, px, obj.scale, obj.opacity, sy); break;
    case 'peak':   drawPeak(g, px, obj.scale, obj.opacity, sy); break;
    case 'dune':   drawDune(g, px, obj.scale, obj.opacity, canvasH, sy); break;
    case 'pillar': drawPillar(g, px, obj.scale, obj.opacity, sy); break;
    case 'grass':  drawGrass(g, px, obj.scale, obj.opacity, sy); break;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TerrainLayersProps {
  width: number;
  height: number;
}

export function TerrainLayers({ width, height }: TerrainLayersProps) {
  const terrain    = useTerrainState();
  const terrainRef = useRef(terrain);
  terrainRef.current = terrain;

  const bgRef   = useRef<Graphics | null>(null);
  const farRef  = useRef<Graphics | null>(null);
  const midRef  = useRef<Graphics | null>(null);
  const nearRef = useRef<Graphics | null>(null);
  const silRef  = useRef<Graphics | null>(null);

  /** Tracks what geometry is currently drawn — avoids per-frame redraws. */
  const drawnRef     = useRef<{ nodeX: number; nodeY: number; biome: string } | null>(null);
  const prevEnabled  = useRef(false);
  const prevTrigger  = useRef(0);
  const scrollAnim   = useRef<{ startNear: number; startMid: number; t0: number } | null>(null);

  // Stable draw callback: empty so @pixi/react never auto-clears our content.
  const noDraw = useCallback(() => {}, []);

  useTick(() => {
    const t   = terrainRef.current;
    const bg  = bgRef.current;
    const far = farRef.current;
    const mid = midRef.current;
    const near = nearRef.current;
    const sil = silRef.current;
    if (!bg || !far || !mid || !near || !sil) return;

    // ── Enable / disable ─────────────────────────────────────────────────
    if (!t.enabled) {
      if (prevEnabled.current) {
        bg.clear(); far.clear(); mid.clear(); near.clear(); sil.clear();
        drawnRef.current = null;
        prevEnabled.current = false;
      }
      return;
    }
    prevEnabled.current = true;

    // ── Redraw static geometry when node or biome changes ────────────────
    const needsRedraw =
      !drawnRef.current ||
      drawnRef.current.nodeX !== t.nodeX ||
      drawnRef.current.nodeY !== t.nodeY ||
      drawnRef.current.biome !== t.biome;

    if (needsRedraw) {
      const colors  = BIOME_COLORS[t.biome] ?? BIOME_COLORS.forest;
      const objType = BIOME_OBJECT_TYPE[t.biome] ?? 'tree';
      const objects = generateObjects(t.nodeX, t.nodeY, objType);
      const sy      = height / 100; // SVG y-unit → pixel

      // Background (sky + ground + fog)
      bg.clear();
      bg.x = 0;
      drawSky(bg, width, height, colors.skyTopHex, colors.skyBotHex);
      bg.setFillStyle({ color: colors.groundHex, alpha: 1 });
      bg.rect(0, 0.78 * height, width, 0.22 * height);
      bg.fill();
      bg.setFillStyle({ color: colors.midHex, alpha: colors.midAlpha });
      bg.rect(0, 0.73 * height, width, 0.10 * height);
      bg.fill();
      drawFog(bg, width, height, colors.fogHex, colors.fogAlpha);

      // Far objects (static — far terrain barely moves)
      far.clear(); far.x = 0;
      objects.filter(o => o.layer === 'far').forEach(obj =>
        drawObject(far, obj, objType, width, height, sy)
      );

      // Mid objects (geometry at local x=0; parallax via .x transform)
      mid.clear(); mid.x = 0;
      objects.filter(o => o.layer === 'mid').forEach(obj =>
        drawObject(mid, obj, objType, width, height, sy)
      );

      // Near objects
      near.clear(); near.x = 0;
      objects.filter(o => o.layer === 'near').forEach(obj =>
        drawObject(near, obj, objType, width, height, sy)
      );

      // Silhouettes (removed - no party shapes at bottom)
      sil.clear(); sil.x = 0;

      drawnRef.current = { nodeX: t.nodeX, nodeY: t.nodeY, biome: t.biome };
      scrollAnim.current = null;
      prevTrigger.current = t.stepTrigger;
    }

    // ── Start scroll animation on new step ───────────────────────────────
    if (t.stepTrigger !== prevTrigger.current) {
      prevTrigger.current = t.stepTrigger;
      const sign = dirSign(t.facing);
      scrollAnim.current = {
        startNear: sign * 32,
        startMid:  sign * 15,
        t0: performance.now(),
      };
    }

    // ── Compute scroll offset (350 ms ease-out cubic) ────────────────────
    let scrollNear = 0, scrollMid = 0;
    if (scrollAnim.current) {
      const p    = Math.min((performance.now() - scrollAnim.current.t0) / 350, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      scrollNear = scrollAnim.current.startNear * (1 - ease);
      scrollMid  = scrollAnim.current.startMid  * (1 - ease);
      if (p >= 1) scrollAnim.current = null;
    }

    // ── Parallax translate (step-progress creep + scroll) ────────────────
    const sign = dirSign(t.facing);
    mid.x  = t.stepProgress * -8  * sign + scrollMid;
    near.x = t.stepProgress * -18 * sign + scrollNear;
  });

  return (
    <>
      {/* Layer order matches docs/terrain-path-b.md layers 1–5 */}
      <pixiGraphics ref={(g: Graphics | null) => { bgRef.current   = g; }} draw={noDraw} />
      <pixiGraphics ref={(g: Graphics | null) => { farRef.current  = g; }} draw={noDraw} />
      <pixiGraphics ref={(g: Graphics | null) => { midRef.current  = g; }} draw={noDraw} />
      <pixiGraphics ref={(g: Graphics | null) => { nearRef.current = g; }} draw={noDraw} />
      <pixiGraphics ref={(g: Graphics | null) => { silRef.current  = g; }} draw={noDraw} />
    </>
  );
}
