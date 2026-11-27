// The village map's world layers, drawn between the painted ground and the tokens:
// topography (painted hill/water/rock washes, pencil contours, sun-driven hillshade)
// and the light field (time-of-day grade, darkness by light level, fog of war as
// unpainted paper, warm pools round each light). Everything is baked or computed on
// change and drawn by the compositor; nothing animates per frame except optional CSS
// flicker on the high tier. Tokens, labels and buttons sit above these layers, so
// play stays readable at any hour.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { paintCanvas, DEFAULT_PAINT } from '../../proto/watercolorPaint';
import type { WashPalette } from '../../proto/watercolorWash';
import { useFxQuality } from '../../proto/fxQuality';
import type { GameState } from '../rules/game';
import { MAP_COLS, MAP_ROWS, tileIndex } from '../rules/map';
import { ambientFor, knownTiles, localLight, terrainAmbient, villageLights, type Ambient, type VillageLight } from '../rules/light';
import { HILL_FROM, MOUNTAIN_FROM, SNOW_FROM, WATER_BELOW, WORLD_BOUNDS, contours, heightAt, slopeAt, smoothstep, tileHeight, valueNoise } from '../rules/terrain';

const B = WORLD_BOUNDS;
const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
/** `?reveal` shows the whole world (terrain review); `?nofog` too. */
export const REVEAL_ALL = params.has('reveal') || params.has('nofog');

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------- Known squares (fog-of-war memory), kept per game seed ----------

const SEEN_KEY = 'exploritaire.village.seen.v1';
function loadSeen(seed: number): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null');
    return raw && raw.seed === seed && Array.isArray(raw.tiles) ? raw.tiles.filter(Number.isInteger) : [];
  } catch { return []; }
}

export function useVillageLight(game: GameState) {
  const lights = useMemo(() => villageLights(game), [game.parties, game.village.plots, game.den, game.rankReached]);
  const ambient = useMemo(() => ambientFor(game), [game.minutes, game.village, game.night]);
  const seen = useRef<{ seed: number; tiles: Set<number> } | null>(null);
  if (!seen.current || seen.current.seed !== game.seed) seen.current = { seed: game.seed, tiles: new Set(loadSeen(game.seed)) };
  // A fresh day-one game forgets the old map.
  if (game.day === 1 && game.minutes === 0 && !game.village.plots.some(Boolean)) seen.current.tiles = new Set();
  const known = useMemo(() => knownTiles(seen.current!.tiles, game, lights), [lights, game.rankReached, game.seed]);
  useEffect(() => {
    seen.current = { seed: game.seed, tiles: known };
    try { localStorage.setItem(SEEN_KEY, JSON.stringify({ seed: game.seed, tiles: [...known] })); } catch { /* private mode */ }
  }, [known, game.seed]);
  return { lights, ambient, known };
}

// ---------- Terrain bake ----------

function stamp(ctx: CanvasRenderingContext2D, palette: WashPalette, variation: number, x: number, y: number, w: number, h: number, angle: number, alpha: number) {
  const wash = paintCanvas(palette, DEFAULT_PAINT, variation % 6);
  if (!wash) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(wash, -w / 2, -h / 2, w, h);
  ctx.restore();
}

const terrainCache = new Map<number, HTMLCanvasElement>();
/**
 * Terrain colour, painted like the grove floor (portals.html?tree): rotated radial-dab
 * wash islands, here placed by the height field: ochre on hill shoulders, slate on
 * rock, white dabs on the snow line, blue in the lake basin, a worn earth berm.
 */
function bakeTerrain(px: number, rich: boolean): HTMLCanvasElement {
  const hit = terrainCache.get(px);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = B.w * px; c.height = B.h * px;
  const ctx = c.getContext('2d')!;
  const random = rng(5150);
  const at = (x: number, y: number) => [(x - B.x) * px, (y - B.y) * px] as const;
  for (let y = B.y; y < B.y + B.h; y++) for (let x = B.x; x < B.x + B.w; x++) {
    const h = tileHeight(x, y), slope = slopeAt(x, y);
    const inPatch = x >= 0 && x < MAP_COLS && y >= 0 && y < MAP_ROWS;
    const [cx, cy] = at(x + 0.5, y + 0.5);
    const s = px * (1.1 + random() * 0.8), a = random() * Math.PI;
    if (h < WATER_BELOW) {
      stamp(ctx, 'water', x * 7 + y, cx, cy, s * 1.5, s * 1.2, a, Math.min(0.85, 0.35 + (WATER_BELOW - h) * 0.45));
      continue;
    }
    if (h >= MOUNTAIN_FROM) {
      stamp(ctx, 'slate', x * 3 + y, cx, cy, s * 1.3, s, a, 0.5 + Math.min(0.4, (h - MOUNTAIN_FROM) * 0.12));
      if (random() < 0.35) stamp(ctx, 'wine', x * 5 + y, cx, cy, s, s * 0.8, a + 1, 0.18);
      if (h >= SNOW_FROM) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.5);
        g.addColorStop(0, `rgba(240,242,238,${(0.4 + Math.min(0.35, (h - SNOW_FROM) * 0.25)).toFixed(2)})`);
        g.addColorStop(1, 'rgba(246,247,243,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
      }
      continue;
    }
    if (inPatch && h < 0.6) continue; // the clearing keeps its own painted ground
    if (h >= HILL_FROM) stamp(ctx, random() < 0.6 ? 'dirt' : 'woodland', x + y * 5, cx, cy, s * 1.2, s, a, 0.3 + Math.min(0.3, (h - HILL_FROM) * 0.1));
    else if (h > 0.75 && slope > 0.35) stamp(ctx, 'dirt', x * 11 + y, cx, cy, s, s * 0.7, a, 0.22); // berm and banks
    else if (rich && random() < 0.18) stamp(ctx, 'woodland', x * 13 + y, cx, cy, s * 1.3, s, a, 0.3);
  }
  terrainCache.set(px, c);
  if (terrainCache.size > 3) terrainCache.delete(terrainCache.keys().next().value!);
  return c;
}

/** Contour paths in tile units, cached once. */
let contourCache: { minor: string; major: string; shore: string } | null = null;
function contourPaths() {
  if (contourCache) return contourCache;
  const levels = [WATER_BELOW, 0.75, 1.5, 2.25, 3, 4, 5, 6, 7, 8, 9];
  const all = contours(levels, 0.5);
  const path = (lvls: number[]) => lvls.flatMap(l => (all.get(l) ?? []).map(([a, b, c, d]) =>
    `M${(a - B.x).toFixed(2)} ${(b - B.y).toFixed(2)}L${(c - B.x).toFixed(2)} ${(d - B.y).toFixed(2)}`)).join('');
  contourCache = { shore: path([WATER_BELOW]), minor: path([0.75, 2.25, 5, 7, 9]), major: path([1.5, 3, 4, 6, 8]) };
  return contourCache;
}

/** Hillshade for the current sun, at two samples per tile (smooth, upscaled by the compositor). */
function paintShade(canvas: HTMLCanvasElement, a: Ambient) {
  const S = 2, W = B.w * S, H = B.h * S;
  if (canvas.width !== W) { canvas.width = W; canvas.height = H; }
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const elevation = a.night ? 0.9 : 0.32 + a.sun * 0.85;
  const lx = a.sunDir.x * Math.cos(elevation), ly = a.sunDir.y * Math.cos(elevation), lz = Math.sin(elevation);
  const strength = a.night ? 0.35 : 0.7 + a.twilight * 0.4;
  const e = 0.35;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = B.x + (i + 0.5) / S, y = B.y + (j + 0.5) / S;
    const dx = (heightAt(x + e, y) - heightAt(x - e, y)) / (2 * e), dy = (heightAt(x, y + e) - heightAt(x, y - e)) / (2 * e);
    const k = 0.55, nx = -dx * k, ny = -dy * k, len = Math.hypot(nx, ny, 1);
    const lit = (nx * lx + ny * ly + lz) / len - lz;
    const grain = 0.75 + 0.5 * valueNoise(x * 3.1, y * 3.1, 3);
    const o = (j * W + i) * 4;
    if (lit < 0) {
      img.data[o] = a.shade.r; img.data[o + 1] = a.shade.g; img.data[o + 2] = a.shade.b + 18;
      img.data[o + 3] = Math.min(120, -lit * 190 * strength * grain);
    } else {
      img.data[o] = a.sunColor.r; img.data[o + 1] = a.sunColor.g; img.data[o + 2] = a.sunColor.b;
      img.data[o + 3] = Math.min(70, lit * 170 * strength * grain * (a.night ? 0.3 : 1));
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- Light field ----------

const PAPER = { r: 205, g: 193, b: 164 };
/**
 * Darkness by light level for known land, and unpainted paper over unknown land.
 * Known-ness is interpolated between square centres and roughened with noise, so the
 * edge of the explored map reads like a wash that stopped, not a staircase.
 */
function paintLight(canvas: HTMLCanvasElement, a: Ambient, lights: readonly VillageLight[], known: Set<number>, S: number) {
  const W = B.w * S, H = B.h * S;
  if (canvas.width !== W) { canvas.width = W; canvas.height = H; }
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const knownAt = (x: number, y: number) => REVEAL_ALL || known.has(tileIndex(x, y)) ? 1 : 0;
  // Paper takes the light of the hour too, so it never glows at night.
  const paperLight = a.night ? 0.1 : 0.42 + a.ambient * 0.5;
  const paper = { r: PAPER.r * paperLight + a.shade.r * (1 - paperLight), g: PAPER.g * paperLight + a.shade.g * (1 - paperLight), b: PAPER.b * paperLight + a.shade.b * (1 - paperLight) };
  for (let j = 0; j < H; j++) {
    const y = B.y + (j + 0.5) / S;
    const ty = Math.floor(y - 0.5), fy = y - 0.5 - ty;
    for (let i = 0; i < W; i++) {
      const x = B.x + (i + 0.5) / S;
      const tx = Math.floor(x - 0.5), fx = x - 0.5 - tx;
      const k = (knownAt(tx, ty) * (1 - fx) + knownAt(tx + 1, ty) * fx) * (1 - fy) + (knownAt(tx, ty + 1) * (1 - fx) + knownAt(tx + 1, ty + 1) * fx) * fy;
      const n = valueNoise(x * 0.9, y * 0.9, 12) * 0.55 + valueNoise(x * 2.6, y * 2.6, 13) * 0.3 + valueNoise(x * 7, y * 7, 14) * 0.15;
      // The wash stops somewhere inside the one-square band between known and unknown centres.
      const edge = Math.max(0.22, Math.min(0.78, 0.5 + (n - 0.5) * 1.4));
      const knownness = k <= 0 ? 0 : k >= 1 ? 1 : smoothstep(edge - 0.16, edge + 0.16, k);
      const h = heightAt(x, y);
      const ambient = terrainAmbient(a, h);
      const local = localLight(lights, x, y);
      const total = 1 - (1 - ambient) * (1 - local);
      const dark = 0.8 * Math.pow(1 - total, 1.25);
      // Mountains loom through the paper by day: you can see the range before you reach it.
      const loom = a.night ? 0 : Math.max(0, Math.min(1, (h - 3) / 4)) * 0.42 * a.ambient;
      const fiber = valueNoise(x * 11, y * 3, 15) - 0.5;
      const fogA = 0.96 - loom - (n - 0.5) * 0.05;
      // Watercolour edge: pigment gathers where the wash stopped drying.
      const rim = Math.max(0, 1 - Math.abs(knownness - 0.32) / 0.22) * 0.22;
      const u = 1 - knownness;
      const tone = 1 + fiber * 0.07 - rim;
      const o = (j * W + i) * 4;
      img.data[o] = (a.shade.r * knownness + paper.r * u) * tone;
      img.data[o + 1] = (a.shade.g * knownness + paper.g * u) * tone;
      img.data[o + 2] = (a.shade.b * knownness + paper.b * u) * tone;
      img.data[o + 3] = Math.round(255 * Math.min(1, dark * knownness + fogA * u + rim * 0.6));
    }
  }
  ctx.putImageData(img, 0, 0);
}

interface Props { game: GameState; tile: number; transposed: boolean; mini: boolean; lights: VillageLight[]; ambient: Ambient; known: Set<number> }

export function WorldLayers({ game, tile, transposed, mini, lights, ambient, known }: Props) {
  const fx = useFxQuality();
  const rich = fx === 'high';
  const terrain = useRef<HTMLCanvasElement>(null);
  const shade = useRef<HTMLCanvasElement>(null);
  const dark = useRef<HTMLCanvasElement>(null);
  const [terrainReady, setTerrainReady] = useState(false);
  const px = rich ? 12 : 6;
  useEffect(() => {
    // Let the first frame paint before the one-off terrain bake.
    const id = requestAnimationFrame(() => {
      const src = bakeTerrain(px, rich), c = terrain.current;
      if (!c) return;
      c.width = src.width; c.height = src.height;
      c.getContext('2d')!.drawImage(src, 0, 0);
      setTerrainReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, [px, rich]);
  const shadeKey = `${ambient.phase}:${ambient.sunDir.x.toFixed(2)}:${ambient.twilight.toFixed(2)}`;
  useEffect(() => { if (shade.current) paintShade(shade.current, ambient); }, [shadeKey]);
  useEffect(() => { if (dark.current) paintLight(dark.current, ambient, lights, known, rich ? 4 : 2); }, [ambient, lights, known, rich]);
  const contour = useMemo(() => contourPaths(), []);

  const frame: CSSProperties = {
    width: MAP_COLS * tile, height: MAP_ROWS * tile,
    transform: transposed ? `translateX(${MAP_ROWS * tile}px) rotate(90deg)` : undefined,
  };
  const box: CSSProperties = { left: B.x * tile, top: B.y * tile, width: B.w * tile, height: B.h * tile };
  const grade = ambient.night ? 0.38 : ambient.twilight * 0.34;
  const poolBoost = Math.min(0.62, Math.max(0, 1 - ambient.ambient) * 1.1);
  return (
    <div className={`vg-world${terrainReady ? ' is-ready' : ''}${mini ? ' is-mini' : ''}`} style={frame} aria-hidden="true">
      <canvas ref={terrain} className="vg-terrain" style={box} />
      <canvas ref={shade} className="vg-hillshade" style={box} />
      <svg className="vg-contours" style={box} viewBox={`0 0 ${B.w} ${B.h}`} preserveAspectRatio="none">
        <path className="is-shore" d={contour.shore} />
        <path className="is-minor" d={contour.minor} />
        <path className="is-major" d={contour.major} />
      </svg>
      <div className="vg-grade" style={{ ...box, opacity: grade, background: `rgb(${ambient.sunColor.r} ${ambient.sunColor.g} ${ambient.sunColor.b})` }} />
      <canvas ref={dark} className="vg-darkness" style={box} />
      {!mini && lights.map(l => {
        const r = l.radius * tile;
        const o = Math.min(0.85, l.strength * poolBoost);
        if (o < 0.04) return null;
        return <span key={l.id} className={`vg-light-pool${l.flicker && rich ? ' is-flicker' : ''}`}
          style={{ left: l.x * tile - r, top: l.y * tile - r, width: r * 2, height: r * 2, opacity: o, '--pool': l.color } as CSSProperties} />;
      })}
    </div>
  );
}

/** Token exposure for the hour: lit tokens stay readable, but they sit in the same light. */
export const exposureFor = (a: Ambient) => (0.66 + 0.34 * Math.min(1, a.ambient / 0.9)).toFixed(3);

export const isKnown = (known: Set<number>, i: number) => REVEAL_ALL || known.has(i);
