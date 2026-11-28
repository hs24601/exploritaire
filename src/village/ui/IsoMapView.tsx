// The village map in isometric view (Eric, 2026-11-27): the same grid, rules and
// callbacks as MapView, drawn on one canvas by a fixed 45° / 35.26° camera.
//
// Draw order (painter's algorithm, no z-buffer):
//   1. Ground plane: every tile on level 0 (meadow, slopes, lake, unknown paper),
//      painted with hillshade and the light field. Nothing on the plane can
//      cover anything standing on it, so it is drawn first, all at once.
//   2. Back to front by diagonal (x + y ascending): raised terrain columns, then
//      the objects standing on that diagonal (buildings, features, kin...).
// Hit testing runs the same geometry backwards: object boxes front to back,
// then the topmost terrain face under the pointer.
//
// Interaction: drag (mouse, pen or one finger) pans, wheel or pinch zooms, tap
// or click acts on a tile exactly as the top-down map does. Keyboard: arrows
// move a tile cursor, Enter acts, + and - zoom, Home recentres.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { canPlaceDevKin, denPlacementBlocker, surfaceUnlocked, type GameState } from '../rules/game';
import { FEATURES, GATE, HERO_START, MAP_COLS, MAP_ROWS, SAPLING, featureAt, fogged, gridReference, isGate, isSapling, onVillageGrid, tileAt, tileIndex, worldCoordinate, type MapSurfaceId } from '../rules/map';
import { SURFACE_ORDER, SURFACES, type SurfaceId } from '../rules/surfaces';
import { BUILDINGS, KIN, type BuildingId, type KinId } from '../rules/village';
import { KIN_TOKENS, type TokenKin } from '../rules/aspen';
import { localLight, terrainAmbient, type Ambient, type VillageLight } from '../rules/light';
import { tileHeight, valueNoise, WATER_BELOW, MOUNTAIN_FROM } from '../rules/terrain';
import { masteryLevel } from '../rules/mastery';
import { useDrag, setDropResolver } from './drag';
import { useKinJumbo } from './useKinJumbo';
import { BUILDING_ART } from './buildingArt';
import { useVillageLight, REVEAL_ALL, bakeTerrain, paintLight, paintShade } from './WorldLayers';
import { useFxQuality } from '../../proto/fxQuality';
import type { Aim } from './MapView';
import type { TravelFrame } from './VillageTravel';
import { TIER_STEP, TILE_H, TILE_W, headingFor, project, unproject, type Heading } from '../iso/projection';
import { ISO_BOUNDS as B, cliffColor, groundColor, hillshade, isoTier, type Rgb } from '../iso/terrainIso';
import { BUILDING_MASSING, BUILDING_FOOTPRINT, featureFootprint, type Massing } from '../iso/footprints';
import { loadIsoSprites, spriteFrame, type LoadedSprite } from '../iso/sprites';
import { mistForPhase, mistPockets, mistSprite } from '../iso/mist';
import './iso.css';

interface Props {
  game: GameState;
  travel: TravelFrame;
  placing: BuildingId | null;
  aim: Aim | null;
  selected: number | null;
  denPlacement: boolean;
  onTile: (tile: number, e: React.MouseEvent) => void;
  onHover: (tile: number | null) => void;
  onFeature: (id: SurfaceId) => void;
  partyTile: number | null;
  selectedKin: TokenKin | null;
  onParty: (tile: number) => void;
  onKin: (tile: number, kin: TokenKin) => void;
  onWanderer: (kin: KinId) => void;
  /** Starting tile size from the stage layout, used for the default zoom. */
  baseTile: number;
}

interface Camera { x: number; y: number; zoom: number }
interface Gesture { pointers: Map<number, { x: number; y: number }>; start: { x: number; y: number }; moved: boolean; pinch?: { d: number; zoom: number } }

const MIN_ZOOM = 0.05, MAX_ZOOM = 1.1;
const ART = '/assets/runtime/environment/watercolor/v1/';
const MEADOW = '/assets/runtime/village/ground/v1/ground-meadow-tile-v1-a.png';
/** `?mist=0` turns the drifting mist off, `?mist=2` doubles it (review). */
const MIST_SCALE = (() => { const q = new URLSearchParams(window.location.search).get('mist'); const n = q === null ? 1 : Number(q || 1); return Number.isFinite(n) ? Math.max(0, n) : 1; })();
/** The home frame: the starting patch down to Hero's start row, as the top-down map frames it. */
const FRAME = { x0: 0, y0: 0, x1: MAP_COLS, y1: Math.max(MAP_ROWS, HERO_START.y + 1) };

/** Camera that fits the home frame in the area below the HUD. */
function homeCamera(w: number, h: number, top: number): Camera {
  const cs = [project(FRAME.x0, FRAME.y0), project(FRAME.x1, FRAME.y0), project(FRAME.x1, FRAME.y1), project(FRAME.x0, FRAME.y1)];
  const fw = Math.max(...cs.map(c => c.x)) - Math.min(...cs.map(c => c.x));
  const fh = Math.max(...cs.map(c => c.y)) - Math.min(...cs.map(c => c.y)) + TILE_H;
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, 0.6, (w - 24) / fw, (h - top - 24) / fh));
  const mid = { x: (FRAME.x0 + FRAME.x1) / 2, y: (FRAME.y0 + FRAME.y1) / 2 };
  // Shift so the frame centres in the open area, not under the HUD.
  const shift = unproject(0, -top / 2 / zoom, 0);
  return { zoom, x: mid.x + shift.x, y: mid.y + shift.y };
}

// ---------- Static terrain, computed once for the whole world ----------

interface TerrainData { tier: Int8Array; base: Float32Array; cliff: Float32Array; height: Float32Array }
let terrainCache: TerrainData | null = null;
const local = (x: number, y: number) => (y - B.y) * B.w + (x - B.x);
const inWorld = (x: number, y: number) => x >= B.x && x < B.x + B.w && y >= B.y && y < B.y + B.h;

function terrainData(): TerrainData {
  if (terrainCache) return terrainCache;
  const n = B.w * B.h;
  const tier = new Int8Array(n), base = new Float32Array(n * 3), cliff = new Float32Array(n * 3), height = new Float32Array(n);
  for (let y = B.y; y < B.y + B.h; y++) for (let x = B.x; x < B.x + B.w; x++) {
    const i = local(x, y);
    tier[i] = isoTier(x, y);
    height[i] = tileHeight(x, y);
    base.set(groundColor(x, y), i * 3);
    cliff.set(cliffColor(x, y), i * 3);
  }
  terrainCache = { tier, base, cliff, height };
  return terrainCache;
}

/** Painted hillshade (-1..1) for one sun position, cached because it only moves with the clock's phase. */
let shadeCache: { key: string; shade: Float32Array } | null = null;
function shadeData(a: Ambient): Float32Array {
  const elevation = a.night ? 0.9 : 0.32 + a.sun * 0.85;
  const key = `${a.sunDir.x.toFixed(2)}:${a.sunDir.y.toFixed(2)}:${elevation.toFixed(2)}`;
  if (shadeCache?.key === key) return shadeCache.shade;
  const shade = new Float32Array(B.w * B.h);
  for (let y = B.y; y < B.y + B.h; y++) for (let x = B.x; x < B.x + B.w; x++) shade[local(x, y)] = hillshade(x, y, a.sunDir, elevation);
  shadeCache = { key, shade };
  return shade;
}

/** Light per tile (0..1, and the local-light share for warmth) plus hillshade. */
function lightData(a: Ambient, lights: readonly VillageLight[], height: Float32Array) {
  const n = B.w * B.h;
  const total = new Float32Array(n), warm = new Float32Array(n);
  for (let y = B.y; y < B.y + B.h; y++) for (let x = B.x; x < B.x + B.w; x++) {
    const i = local(x, y);
    const amb = terrainAmbient(a, height[i]);
    const loc = lights.length ? localLight(lights, x + 0.5, y + 0.5) : 0;
    total[i] = Math.min(1, 1 - (1 - amb) * (1 - loc));
    warm[i] = loc;
  }
  return { total, warm, shade: shadeData(a) };
}

// ---------- Colour helpers ----------

const rgb = (c: ArrayLike<number>, k = 1, add: Rgb = [0, 0, 0]) =>
  `rgb(${Math.max(0, Math.min(255, c[0] * k + add[0])) | 0},${Math.max(0, Math.min(255, c[1] * k + add[1])) | 0},${Math.max(0, Math.min(255, c[2] * k + add[2])) | 0})`;
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** A light's CSS colour at an alpha, for canvas gradients (the top-down map uses color-mix). */
const withAlpha = (color: string, alpha: number) => color.startsWith('#') && color.length >= 7
  ? `rgba(${hex(color).join(',')},${alpha})` : `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;

/**
 * Light a colour the way the top-down darkness layer does (WorldLayers paintLight):
 * it darkens toward the hour's shade colour by 0.8 * (1 - light)^1.25. Used for
 * everything that stands above the ground plane (columns, blocks, props); the
 * ground plane itself gets the shared layer.
 */
function lit(c: ArrayLike<number>, light: number, warm: number, a: Ambient, face = 1): string {
  const dark = 0.8 * Math.pow(Math.max(0, 1 - light), 1.25);
  const k = (1 - dark) * face;
  const w = warm * (a.night ? 0.6 : 0.2);
  return rgb(c, k, [a.shade.r * dark + 46 * w, a.shade.g * dark + 26 * w, a.shade.b * dark]);
}

// ---------- Images (portraits for placeholder standees) ----------

const images = new Map<string, HTMLImageElement>();
function image(src: string, onLoad: () => void) {
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.addEventListener('load', onLoad, { once: true });
    img.src = src;
    images.set(src, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

const KIN_RIM: Record<string, string> = { hero: '#f0bf5a', mochi: '#e07aab', banks: '#a9bbd0', demi: '#74c487', cir: '#8b9cff' };

// ---------- Scene objects ----------

type Hit = { kind: 'tile'; tile: number } | { kind: 'feature'; id: MapSurfaceId } | { kind: 'kin'; tile: number; kin: TokenKin; members: number }
  | { kind: 'wanderer'; kin: KinId };
interface HitBox { l: number; t: number; r: number; b: number; hit: Hit }

interface Standee { kin: TokenKin | KinId; gx: number; gy: number; selected: boolean; wanderer: boolean; tile: number; members: number; heading: Heading; walkingMs?: number }

export function IsoMapView({ game, travel, placing, aim, selected, denPlacement, onTile, onHover, onFeature, partyTile, selectedKin,
  onParty, onKin, onWanderer, baseTile }: Props) {
  const inspectKin = useKinJumbo();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hudSpace, setHudSpace] = useState(0);
  const [cam, setCam] = useState<Camera>({ x: 4.5, y: 4.5, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (baseTile * 1.3) / TILE_W)) });
  /** Until the player pans or zooms, the camera keeps re-fitting the home frame (rotation, HUD changes). */
  const manual = useRef(false);
  const camRef = useRef(cam);
  camRef.current = cam;
  const [hover, setHover] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [sprites, setSprites] = useState<Map<string, LoadedSprite>>(new Map());
  const [, setImageTick] = useState(0);
  const hits = useRef<HitBox[]>([]);
  const gesture = useRef<Gesture | null>(null);
  const swallowClick = useRef(false);
  const { dragging, over } = useDrag();
  const { lights, ambient, known } = useVillageLight(game);
  const terrain = terrainData();
  const light = useMemo(() => lightData(ambient, lights, terrain.height), [ambient, lights, terrain]);

  // The top-down map's atmosphere layers (WorldLayers), baked in grid space and laid on
  // the isometric ground plane with one affine transform: the watercolour terrain wash,
  // sun hillshade, and the light field with its paper fog of war.
  const fx = useFxQuality();
  const rich = fx === 'high';
  const washPx = rich ? 12 : 6, lightPx = rich ? 4 : 2;
  const [wash, setWash] = useState<HTMLCanvasElement | null>(null);
  const shadeLayer = useMemo(() => document.createElement('canvas'), []);
  const lightLayer = useMemo(() => document.createElement('canvas'), []);
  const [layerTick, setLayerTick] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWash(bakeTerrain(washPx, rich)));
    return () => cancelAnimationFrame(id);
  }, [washPx, rich]);
  const shadeKey = `${ambient.phase}:${ambient.sunDir.x.toFixed(2)}:${ambient.twilight.toFixed(2)}`;
  useEffect(() => { paintShade(shadeLayer, ambient); setLayerTick(n => n + 1); }, [shadeKey]);
  useEffect(() => { paintLight(lightLayer, ambient, lights, known, lightPx); setLayerTick(n => n + 1); }, [ambient, lights, known, lightPx]);
  const v = game.village;

  useEffect(() => { let live = true; void loadIsoSprites().then(s => live && setSprites(s)); return () => { live = false; }; }, []);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) });
      setHudSpace(parseFloat(getComputedStyle(el).getPropertyValue('--hud-space')) || 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Tiles as the player sees them: unknown land lies flat as paper. */
  const isKnown = (x: number, y: number) => REVEAL_ALL || known.has(tileIndex(x, y));
  const tierOf = (x: number, y: number) => inWorld(x, y) && isKnown(x, y) ? terrain.tier[local(x, y)] : 0;
  const topZ = (x: number, y: number) => tierOf(x, y) * TIER_STEP;

  // Screen <-> world for the current camera (CSS pixels, relative to the canvas).
  const origin = project(cam.x, cam.y, 0);
  const toScreen = (x: number, y: number, z = 0) => {
    const p = project(x, y, z);
    return { x: (p.x - origin.x) * cam.zoom + size.w / 2, y: (p.y - origin.y) * cam.zoom + size.h / 2 };
  };
  const toAuthoring = (px: number, py: number) => ({ x: (px - size.w / 2) / cam.zoom + origin.x, y: (py - size.h / 2) / cam.zoom + origin.y });

  /** Topmost terrain tile under a canvas point. */
  const tileUnder = (px: number, py: number): number | null => {
    const a = toAuthoring(px, py);
    for (let tier = 12; tier >= 0; tier--) {
      const z = tier * TIER_STEP;
      const g = unproject(a.x, a.y, z);
      const x = Math.floor(g.x), y = Math.floor(g.y);
      if (!onVillageGrid(x, y)) continue;
      if (topZ(x, y) >= z - 1e-6) return tileIndex(x, y);
    }
    return null;
  };

  const hitAt = (px: number, py: number): Hit | null => {
    for (let k = hits.current.length - 1; k >= 0; k--) {
      const h = hits.current[k];
      if (px >= h.l && px <= h.r && py >= h.t && py <= h.b) return h.hit;
    }
    const t = tileUnder(px, py);
    return t === null ? null : { kind: 'tile', tile: t };
  };

  // Card drags (inspiration cards, buildings, dev kin) drop onto the canvas through the drag layer.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    return setDropResolver(el, (clientX, clientY) => {
      const box = el.getBoundingClientRect();
      const hit = hitAt(clientX - box.left, clientY - box.top);
      if (!hit) return null;
      if (hit.kind === 'feature') return { drop: 'feature', index: SURFACE_ORDER.indexOf(hit.id) };
      const t = hit.kind === 'tile' || hit.kind === 'kin' ? hit.tile : null;
      if (t === null) return null;
      const { x, y } = tileAt(t);
      if (isSapling(x, y)) return { drop: 'sapling', index: -1 };
      const f = featureAt(x, y);
      return f ? { drop: 'feature', index: SURFACE_ORDER.indexOf(f) } : { drop: 'tile', index: t };
    });
  });

  // ---------- Drawing ----------

  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el || !size.w || !size.h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (el.width !== Math.round(size.w * dpr) || el.height !== Math.round(size.h * dpr)) {
      el.width = Math.round(size.w * dpr); el.height = Math.round(size.h * dpr);
    }
    const ctx = el.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const z = cam.zoom;
    const boxes: HitBox[] = [];
    const a = ambient;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sunFaceS = 0.8 + 0.14 * Math.max(-1, Math.min(1, a.sunDir.y));
    const sunFaceE = 0.68 + 0.14 * Math.max(-1, Math.min(1, a.sunDir.x));
    const redraw = () => setImageTick(n => n + 1);

    // Visible tile range: the screen corners on the ground plane and on the highest land.
    const corners = [[0, 0], [size.w, 0], [0, size.h], [size.w, size.h]].flatMap(([px, py]) => {
      const p = toAuthoring(px, py);
      return [unproject(p.x, p.y, 0), unproject(p.x, p.y, 6)];
    });
    const x0 = Math.max(B.x, Math.floor(Math.min(...corners.map(c => c.x))) - 1), x1 = Math.min(B.x + B.w - 1, Math.ceil(Math.max(...corners.map(c => c.x))) + 1);
    const y0 = Math.max(B.y, Math.floor(Math.min(...corners.map(c => c.y))) - 1), y1 = Math.min(B.y + B.h - 1, Math.ceil(Math.max(...corners.map(c => c.y))) + 1);

    const poly = (pts: { x: number; y: number }[], fill: string, stroke?: string, width = 1) => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
    };
    const diamond = (x: number, y: number, zz: number, inset = 0) => [
      toScreen(x + inset, y + inset, zz), toScreen(x + 1 - inset, y + inset, zz), toScreen(x + 1 - inset, y + 1 - inset, zz), toScreen(x + inset, y + 1 - inset, zz),
    ];
    const visible = (pts: { x: number; y: number }[]) => pts.some(p => p.x > -TILE_W * z && p.x < size.w + TILE_W * z && p.y > -TILE_H * z && p.y < size.h + TILE_H * z * 4);
    const tileLight = (x: number, y: number) => { const i = local(x, y); return { t: light.total[i], w: light.warm[i] }; };

    const groundFill = (x: number, y: number, zz: number) => {
      const i = local(x, y);
      const base = terrain.base.subarray(i * 3, i * 3 + 3);
      // The ground plane stays unlit here: the shared light layer darkens it and paints the paper fog.
      if (!zz) return rgb(base);
      return lit(base, light.total[i], light.warm[i], a, 1 + light.shade[i] * 0.16);
    };

    const groundOrigin = toScreen(0, 0);
    const makeWash = (url: string, span: number) => {
      const art = image(url, redraw);
      const pattern = art && ctx.createPattern(art, 'repeat');
      if (!art || !pattern) return null;
      const dx = z * TILE_W / 2, dy = z * TILE_H / 2;
      pattern.setTransform(new DOMMatrix([dx * span / art.naturalWidth, dy * span / art.naturalWidth,
        -dx * span / art.naturalHeight, dy * span / art.naturalHeight, groundOrigin.x, groundOrigin.y]));
      return pattern;
    };
    const meadowWash = makeWash(MEADOW, 4);
    const stoneWash = makeWash(ART + 'mountain-ground-v1.png', 5);
    const groundPaint = (x: number, y: number, zz: number, corners: ReturnType<typeof diamond>) => {
      const base = groundFill(x, y, zz);
      poly(corners, base, base, .65);
      const known = isKnown(x, y);
      const height = terrain.height[local(x, y)];
      const wash = known && height >= MOUNTAIN_FROM ? stoneWash : meadowWash;
      if (wash && !(known && height < WATER_BELOW)) {
        ctx.globalCompositeOperation = known ? 'soft-light' : 'luminosity';
        ctx.globalAlpha = known ? .76 : .1;
        ctx.fillStyle = wash;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    };
    /** Draw a grid-space layer (px pixels per tile, origin at grid (ox, oy)) onto the ground plane. */
    const groundLayer = (img: CanvasImageSource, px: number, ox: number, oy: number, alpha = 1, op: GlobalCompositeOperation = 'source-over') => {
      const o = toScreen(ox, oy, 0), hx = TILE_W / 2 * z / px, hy = TILE_H / 2 * z / px;
      ctx.save();
      ctx.setTransform(dpr * hx, dpr * hy, -dpr * hx, dpr * hy, dpr * o.x, dpr * o.y);
      ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op;
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    };

    // Tile marks: selection, aim, hover, keyboard cursor and placement eligibility.
    const denDragging = dragging?.kind === 'inspiration-card';
    const targetTile = over?.drop === 'tile' ? over.index : null;
    const mark = (x: number, y: number, zz: number) => {
      const i = tileIndex(x, y);
      const open = !v.plots[i] && !isGate(x, y) && !featureAt(x, y) && !isSapling(x, y) && !fogged(x, y, game.rankReached);
      let stroke: string | null = null, fill: string | null = null, width = 2;
      if (placing && open && x >= -2 && x < 11 && y >= -2 && y < 9) { stroke = 'rgba(255,248,223,.34)'; width = 1; }
      if (denPlacement && !denDragging && !denPlacementBlocker(game, i, !!game.den)) { stroke = 'rgba(240,191,90,.7)'; fill = 'rgba(240,191,90,.12)'; }
      if (targetTile === i && (denDragging || dragging?.kind === 'dev-kin' || dragging?.kind === 'building')) {
        const ok = dragging?.kind === 'dev-kin' ? canPlaceDevKin(game, i) : denDragging ? !denPlacementBlocker(game, i, !!game.den) : !aim?.preview.blocker;
        stroke = ok ? '#f0bf5a' : '#e66a6a'; fill = ok ? 'rgba(240,191,90,.2)' : 'rgba(230,106,106,.2)'; width = 3;
      }
      if (aim?.tile === i) { stroke = aim.preview.blocker ? '#e66a6a' : '#f0bf5a'; width = 3; }
      if (selected === i || partyTile === i) { stroke = '#fff3cf'; width = 3; }
      if (hover === i && !stroke) { stroke = 'rgba(255,248,223,.55)'; width = 2; }
      if (cursor === i) { stroke = '#8b9cff'; width = 3; }
      if (!stroke && !fill) return;
      const d = diamond(x, y, zz, 0.04);
      ctx.beginPath(); ctx.moveTo(d[0].x, d[0].y); for (const p of d.slice(1)) ctx.lineTo(p.x, p.y); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
    };

    // 1. Ground plane.
    const gridLines = z * TILE_W > 46;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (tierOf(x, y) > 0) continue;
      const d = diamond(x, y, 0);
      if (!visible(d)) continue;
      // Slight overlap hides hairline seams between neighbouring diamonds.
      groundPaint(x, y, 0, d);
    }
    void layerTick;
    if (wash) groundLayer(wash, washPx, B.x, B.y);
    if (shadeLayer.width) groundLayer(shadeLayer, 2, B.x, B.y);
    if (lightLayer.width) groundLayer(lightLayer, lightPx, B.x, B.y);
    if (gridLines) {
      ctx.beginPath();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (tierOf(x, y) > 0 || !isKnown(x, y)) continue;
        const d = diamond(x, y, 0);
        ctx.moveTo(d[0].x, d[0].y); for (const p of d.slice(1)) ctx.lineTo(p.x, p.y); ctx.closePath();
      }
      ctx.strokeStyle = placing ? 'rgba(255,248,223,.23)' : 'rgba(244,233,184,.08)'; ctx.lineWidth = 1; ctx.stroke();
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (tierOf(x, y) === 0 && onVillageGrid(x, y)) mark(x, y, 0);

    // Light pools, as the top-down map draws them (screen blend, same strength curve and
    // flicker), laid on the ground as ellipses at the height of the land under the light.
    const now = performance.now();
    const poolBoost = Math.min(0.62, Math.max(0, 1 - a.ambient) * 1.1);
    for (const source of lights) {
      const o = Math.min(0.85, source.strength * poolBoost);
      if (o < 0.04) continue;
      const flicker = source.flicker && rich && !reducedMotion
        ? 1 + 0.025 * Math.sin(now / 410 + source.x * 3) + 0.012 * Math.sin(now / 157 + source.y) : 1;
      const c = toScreen(source.x, source.y, topZ(Math.floor(source.x), Math.floor(source.y)));
      const r = TILE_W * z * source.radius / Math.SQRT2 * flicker;
      ctx.save();
      ctx.translate(c.x, c.y); ctx.scale(1, TILE_H / TILE_W);
      const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      pool.addColorStop(0, withAlpha(source.color, 0.62)); pool.addColorStop(0.52, withAlpha(source.color, 0.22)); pool.addColorStop(1, withAlpha(source.color, 0));
      ctx.globalAlpha = o; ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = pool; ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }

    // ---------- Object builders (placeholder blocks) ----------

    const box = (gx0: number, gy0: number, gx1: number, gy1: number, zb: number, h: number, color: Rgb, lt: { t: number; w: number }, alpha = 1) => {
      ctx.globalAlpha = alpha;
      const zt = zb + h;
      poly([toScreen(gx0, gy1, zb), toScreen(gx1, gy1, zb), toScreen(gx1, gy1, zt), toScreen(gx0, gy1, zt)], lit(color, lt.t, lt.w, a, sunFaceS));
      poly([toScreen(gx1, gy0, zb), toScreen(gx1, gy1, zb), toScreen(gx1, gy1, zt), toScreen(gx1, gy0, zt)], lit(color, lt.t, lt.w, a, sunFaceE));
      poly([toScreen(gx0, gy0, zt), toScreen(gx1, gy0, zt), toScreen(gx1, gy1, zt), toScreen(gx0, gy1, zt)], lit(color, lt.t, lt.w, a, 1.08));
      ctx.globalAlpha = 1;
    };
    const roof = (kind: 'gable' | 'pyramid', gx0: number, gy0: number, gx1: number, gy1: number, zb: number, h: number, color: Rgb, lt: { t: number; w: number }, alpha = 1) => {
      ctx.globalAlpha = alpha;
      const zt = zb + h, my = (gy0 + gy1) / 2, mx = (gx0 + gx1) / 2;
      const f = (k: number) => lit(color, lt.t, lt.w, a, k);
      if (kind === 'pyramid') {
        const apex = toScreen(mx, my, zt);
        poly([toScreen(gx0, gy0, zb), toScreen(gx1, gy0, zb), apex], f(0.95));
        poly([toScreen(gx0, gy0, zb), toScreen(gx0, gy1, zb), apex], f(0.78));
        poly([toScreen(gx0, gy1, zb), toScreen(gx1, gy1, zb), apex], f(sunFaceS));
        poly([toScreen(gx1, gy0, zb), toScreen(gx1, gy1, zb), apex], f(sunFaceE));
      } else {
        const r0 = toScreen(gx0, my, zt), r1 = toScreen(gx1, my, zt);
        poly([toScreen(gx0, gy0, zb), toScreen(gx1, gy0, zb), r1, r0], f(1.02));
        poly([toScreen(gx0, gy0, zb), toScreen(gx0, gy1, zb), r0], f(0.72));
        poly([toScreen(gx0, gy1, zb), toScreen(gx1, gy1, zb), r1, r0], f(sunFaceS));
        poly([toScreen(gx1, gy0, zb), toScreen(gx1, gy1, zb), r1], f(sunFaceE));
      }
      ctx.globalAlpha = 1;
    };
    const massing = (m: Massing, x: number, y: number, fw: number, fd: number, zb: number, lt: { t: number; w: number }, alpha = 1) => {
      const gx0 = x + m.inset, gy0 = y + m.inset, gx1 = x + fw - m.inset, gy1 = y + fd - m.inset;
      box(gx0, gy0, gx1, gy1, zb, m.h, hex(m.color), lt, alpha);
      if (m.roof) roof(m.roof, gx0 - 0.04, gy0 - 0.04, gx1 + 0.04, gy1 + 0.04, zb + m.h, m.roofH ?? 0.2, hex(m.roofColor ?? m.color), lt, alpha);
    };
    const record = (pts: { x: number; y: number }[], hit: Hit, pad = 0) => {
      boxes.push({ l: Math.min(...pts.map(p => p.x)) - pad, r: Math.max(...pts.map(p => p.x)) + pad,
        t: Math.min(...pts.map(p => p.y)) - pad, b: Math.max(...pts.map(p => p.y)) + pad, hit });
    };
    const tree = (gx: number, gy: number, zb: number, h: number, w: number, lt: { t: number; w: number }, color: Rgb) => {
      const base = toScreen(gx, gy, zb), top = toScreen(gx, gy, zb + h), half = w * TILE_W * z / 2;
      const trunk = toScreen(gx, gy, zb + h * 0.22);
      ctx.fillStyle = lit([92, 70, 48], lt.t, lt.w, a); ctx.fillRect(base.x - half * 0.14, trunk.y, half * 0.28, base.y - trunk.y);
      poly([{ x: base.x - half, y: trunk.y }, top, { x: base.x, y: trunk.y + half * 0.18 }], lit(color, lt.t, lt.w, a, 0.86));
      poly([{ x: base.x, y: trunk.y + half * 0.18 }, top, { x: base.x + half, y: trunk.y }], lit(color, lt.t, lt.w, a, 1.06));
      return [{ x: base.x - half, y: top.y }, { x: base.x + half, y: base.y }];
    };
    const bush = (gx: number, gy: number, zb: number, r: number, lt: { t: number; w: number }, berries: boolean) => {
      const c = toScreen(gx, gy, zb + r * 0.7), rx = r * TILE_W * z / 2, ry = rx * 0.8;
      ctx.fillStyle = lit([66, 104, 58], lt.t, lt.w, a); ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = lit([96, 138, 74], lt.t, lt.w, a); ctx.beginPath(); ctx.ellipse(c.x + rx * 0.2, c.y - ry * 0.25, rx * 0.6, ry * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      if (berries) {
        ctx.fillStyle = lit([214, 70, 120], lt.t, lt.w, a);
        for (const [dx, dy] of [[-0.4, 0.1], [0.1, -0.3], [0.45, 0.25], [-0.05, 0.4], [-0.5, -0.35]]) {
          ctx.beginPath(); ctx.arc(c.x + dx * rx, c.y + dy * ry, Math.max(1.5, rx * 0.11), 0, Math.PI * 2); ctx.fill();
        }
      }
      return [{ x: c.x - rx, y: c.y - ry }, { x: c.x + rx, y: c.y + ry }];
    };
    const drawSprite = (key: string, gx: number, gy: number, zb: number, heading: Heading = 'S', alpha = 1, walkingMs?: number) => {
      const s = sprites.get(key);
      if (!s) return null;
      const f = spriteFrame(s, heading, performance.now(), walkingMs);
      const k = z * TILE_W / s.def.tileWidthPx;
      const p = toScreen(gx, gy, zb);
      const w = f.sw * k, h = f.sh * k;
      const left = p.x - s.def.pivot[0] * k, top = p.y - s.def.pivot[1] * k;
      ctx.save(); ctx.globalAlpha = alpha;
      if (f.mirror) { ctx.translate(p.x, 0); ctx.scale(-1, 1); ctx.translate(-p.x, 0); }
      ctx.drawImage(s.image, f.sx, f.sy, f.sw, f.sh, left, top, w, h);
      ctx.restore();
      const l = p.x - (f.mirror ? w - s.def.pivot[0] * k : s.def.pivot[0] * k);
      return [{ x: l, y: top }, { x: l + w, y: top + h }];
    };
    const paintedProp = (url: string, gx: number, gy: number, zb: number, width: number, alpha = 1) => {
      const art = image(url, redraw);
      if (!art) return null;
      const p = toScreen(gx, gy, zb);
      const w = width * TILE_W * z, h = w * art.naturalHeight / art.naturalWidth;
      const top = p.y - h * .9;
      ctx.save();
      ctx.globalAlpha = alpha * (a.night ? .67 : 1);
      ctx.fillStyle = '#17222175';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, w * .34, w * .11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(art, p.x - w / 2, top, w, h);
      ctx.restore();
      return [{ x: p.x - w / 2, y: top }, { x: p.x + w / 2, y: top + h }];
    };
    const standee = (s: Standee, zb: number) => {
      const lt = tileLight(Math.floor(s.gx), Math.floor(s.gy));
      const p = toScreen(s.gx, s.gy, zb);
      // Contact shadow first, then the sprite, or the placeholder token: a small upright disc on a peg.
      const w = Math.max(22, TILE_W * z * 0.3);
      ctx.fillStyle = 'rgba(12,16,10,.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, w * 0.42, w * 0.42 * TILE_H / TILE_W, 0, 0, Math.PI * 2); ctx.fill();
      const sprite = drawSprite(`kin.${s.kin}`, s.gx, s.gy, zb, s.heading, 1, s.walkingMs);
      if (!sprite) {
        const bounce = s.walkingMs === undefined ? 0 : Math.abs(Math.sin(s.walkingMs / 53)) * w * 0.12;
        const cy = p.y - w * 0.78 - bounce;
        ctx.fillStyle = '#3b3328'; ctx.fillRect(p.x - 1.5, cy, 3, p.y - cy);
        ctx.beginPath(); ctx.arc(p.x, cy, w / 2, 0, Math.PI * 2);
        ctx.fillStyle = lit([246, 241, 229], Math.max(0.75, lt.t), lt.w, a); ctx.fill();
        ctx.lineWidth = s.selected ? 4 : 2.5; ctx.strokeStyle = s.selected ? '#fff3cf' : KIN_RIM[s.kin] ?? '#d8cfbb'; ctx.stroke();
        const src = s.kin === 'demi' ? null : s.wanderer ? KIN[s.kin as KinId]?.portrait : (KIN_TOKENS[s.kin as TokenKin] as { portrait?: string } | undefined)?.portrait;
        const img = src ? image(src, redraw) : null;
        if (img) {
          ctx.save(); ctx.beginPath(); ctx.arc(p.x, cy, w / 2 - 2, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(img, p.x - w / 2, cy - w / 2, w, w); ctx.restore();
        } else {
          ctx.fillStyle = '#23272e'; ctx.font = `800 ${Math.max(12, w * 0.5)}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText((s.wanderer ? KIN[s.kin as KinId].name : KIN_TOKENS[s.kin as TokenKin].name).slice(0, 1), p.x, cy + 1);
        }
        if (s.wanderer) { ctx.setLineDash([4, 3]); ctx.strokeStyle = '#fff8df'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, cy, w / 2 + 3, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        if (s.walkingMs === undefined) record([{ x: p.x - w / 2, y: cy - w / 2 }, { x: p.x + w / 2, y: p.y }], s.wanderer ? { kind: 'wanderer', kin: s.kin as KinId } : { kind: 'kin', tile: s.tile, kin: s.kin as TokenKin, members: s.members }, 2);
      } else if (s.walkingMs === undefined) {
        record(sprite, s.wanderer ? { kind: 'wanderer', kin: s.kin as KinId } : { kind: 'kin', tile: s.tile, kin: s.kin as TokenKin, members: s.members });
      }
    };

    // ---------- Objects by tile ----------

    const objects = new Map<number, (() => void)[]>();
    const put = (x: number, y: number, draw: () => void) => {
      const k = tileIndex(x, y);
      const list = objects.get(k);
      if (list) list.push(draw); else objects.set(k, [draw]);
    };

    // Sapling.
    put(SAPLING.x, SAPLING.y, () => {
      const zb = topZ(SAPLING.x, SAPLING.y), lt = tileLight(SAPLING.x, SAPLING.y), gx = SAPLING.x + 0.5, gy = SAPLING.y + 0.5;
      const drawn = drawSprite('sapling', gx, gy, zb) ||
        paintedProp('/assets/runtime/village/ground/curious-sapling-seedling-v1.png', gx, gy, zb, .15);
      if (!drawn) {
      box(gx - 0.035, gy - 0.035, gx + 0.035, gy + 0.035, zb, 0.42, [110, 84, 56], lt);
      const c = toScreen(gx, gy, zb + 0.5), r = TILE_W * z * 0.16;
      const g = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.3, r * 0.1, c.x, c.y, r);
      g.addColorStop(0, '#d9f29a'); g.addColorStop(0.6, '#86b85a'); g.addColorStop(1, '#4d7a3b');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
      }
      const c = toScreen(gx, gy, zb + .29), r = TILE_W * z * .08;
      ctx.fillStyle = 'rgba(255,236,160,.9)';
      const t = reducedMotion ? 0 : performance.now() / 900;
      for (let k = 0; k < 4; k++) { const ang = t + k * Math.PI / 2; ctx.beginPath(); ctx.arc(c.x + Math.cos(ang) * r * 1.4, c.y + Math.sin(ang) * r * 0.6 - r * 0.4, Math.max(1.5, r * 0.08), 0, Math.PI * 2); ctx.fill(); }
      record([...(drawn ?? []), ...diamond(SAPLING.x, SAPLING.y, zb)], { kind: 'tile', tile: tileIndex(SAPLING.x, SAPLING.y) });
    });

    // Land features.
    for (const id of SURFACE_ORDER) {
      const f = FEATURES[id], fp = featureFootprint(id);
      const fx = f.rect.x + fp.w - 1, fy = f.rect.y + fp.d - 1;
      put(fx, fy, () => {
        const zb = topZ(f.node.x, f.node.y), lt = tileLight(f.node.x, f.node.y);
        const locked = !surfaceUnlocked(game, id);
        ctx.globalAlpha = locked ? 0.55 : 1;
        const gx = f.rect.x + fp.w / 2, gy = f.rect.y + fp.d / 2;
        const drawn = drawSprite(`feature.${id}`, gx, gy, zb) || paintedProp(ART +
          (id === 'forest' ? 'woods-cluster-sprite-v1.png' : 'berry-patch-sprite-v2.png'), gx, gy, zb, id === 'forest' ? 1 : .8);
        const pts: { x: number; y: number }[] = drawn ?? [];
        if (!drawn && id === 'forest') {
          for (const [dx, dy, h] of [[0.28, 0.3, 0.9], [0.72, 0.36, 1.05], [0.36, 0.72, 0.78], [0.74, 0.76, 0.95]] as const)
            pts.push(...tree(f.rect.x + dx * fp.w, f.rect.y + dy * fp.d, zb, h, 0.36, lt, [58, 102, 64]));
        } else if (!drawn) {
          for (const [dx, dy, r] of [[0.3, 0.32, 0.3], [0.7, 0.38, 0.26], [0.42, 0.72, 0.28], [0.74, 0.74, 0.22]] as const)
            pts.push(...bush(f.rect.x + dx * fp.w, f.rect.y + dy * fp.d, zb, r, lt, !locked));
        }
        ctx.globalAlpha = 1;
        pts.push(...diamond(f.rect.x, f.rect.y, zb));
        record(pts, { kind: 'feature', id });
      });
    }

    // Gate.
    put(GATE.x, GATE.y, () => {
      const zb = topZ(GATE.x, GATE.y), lt = tileLight(GATE.x, GATE.y), x = GATE.x, y = GATE.y;
      const drawn = drawSprite('gate', x + 0.5, y + 0.5, zb);
      if (drawn) return;
      box(x + 0.1, y + 0.16, x + 0.2, y + 0.26, zb, 0.62, [110, 84, 56], lt);
      box(x + 0.1, y + 0.74, x + 0.2, y + 0.84, zb, 0.62, [110, 84, 56], lt);
      box(x + 0.08, y + 0.14, x + 0.22, y + 0.86, zb + 0.62, 0.08, [128, 98, 64], lt);
    });

    // Buildings and the den.
    v.plots.forEach((b, i) => {
      if (!b) return;
      const { x, y } = tileAt(i), fp = BUILDING_FOOTPRINT[b];
      put(x + fp.w - 1, y + fp.d - 1, () => {
        const zb = topZ(x, y), lt = tileLight(x, y);
        const drawn = drawSprite(`building.${b}`, x + fp.w / 2, y + fp.d / 2, zb) ||
          paintedProp(BUILDING_ART[b], x + fp.w / 2, y + fp.d / 2, zb, .72 * Math.max(fp.w, fp.d));
        if (!drawn) massing(BUILDING_MASSING[b], x, y, fp.w, fp.d, zb, lt);
        if (b === 'campfire' || b === 'lantern') {
          const c = toScreen(x + 0.5, y + 0.5, zb + (b === 'lantern' ? 0.7 : 0.25)), r = TILE_W * z * 0.5;
          const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
          g.addColorStop(0, `rgba(255,190,90,${a.night ? 0.5 : 0.18})`); g.addColorStop(1, 'rgba(255,190,90,0)');
          ctx.fillStyle = g; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
        }
        record([...(drawn ?? [toScreen(x, y, zb + 1)]), ...diamond(x, y, zb)], { kind: 'tile', tile: i });
      });
    });
    if (game.den) {
      const d = game.den, { x, y } = tileAt(d.tile);
      put(x, y, () => {
        const zb = topZ(x, y), lt = tileLight(x, y);
        const key = d.dig ? 'den.worksite' : d.level === 2 ? 'den.improved' : 'den.simple';
        const drawn = drawSprite(key, x + 0.5, y + 0.5, zb) ||
          paintedProp('/assets/runtime/village/simple-den/v1/' + (d.dig ? 'puzzle-surface.png' : 'puzzle-complete.png'),
            x + .5, y + .5, zb, .84);
        if (!drawn) {
          const c = toScreen(x + 0.5, y + 0.5, zb), rx = TILE_W * z * (d.level === 2 ? 0.36 : 0.3), ry = rx * 0.75;
          ctx.fillStyle = lit(d.dig ? [138, 110, 74] : [112, 132, 70], lt.t, lt.w, a);
          ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, Math.PI, 0); ctx.ellipse(c.x, c.y, rx, rx * TILE_H / TILE_W, 0, 0, Math.PI); ctx.fill();
          if (!d.dig) { ctx.fillStyle = '#1c1812'; ctx.beginPath(); ctx.ellipse(c.x + rx * 0.1, c.y - ry * 0.05, rx * 0.32, ry * 0.4, 0, Math.PI, 0); ctx.lineTo(c.x + rx * 0.42, c.y + ry * 0.12); ctx.lineTo(c.x - rx * 0.22, c.y + ry * 0.12); ctx.fill(); }
          else { ctx.strokeStyle = '#f0bf5a'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx * 1.1, rx * 1.1 * TILE_H / TILE_W, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        }
        record([toScreen(x + 0.5, y + 0.5, zb + 0.6), ...diamond(x, y, zb)], { kind: 'tile', tile: d.tile });
      });
    }

    // Aim ghost while placing.
    if (aim && !v.plots[aim.tile]) {
      const { x, y } = tileAt(aim.tile), fp = BUILDING_FOOTPRINT[aim.building];
      put(x + fp.w - 1, y + fp.d - 1, () => {
        const zb = topZ(x, y);
        const drawn = drawSprite(`building.${aim.building}`, x + fp.w / 2, y + fp.d / 2, zb, 'S', 0.55);
        if (!drawn) massing(BUILDING_MASSING[aim.building], x, y, fp.w, fp.d, zb, { t: 1, w: 0 }, aim.preview.blocker ? 0.35 : 0.6);
      });
    }

    // Parties and wanderers.
    const spots = (n: number): [number, number][] => n === 1 ? [[0.5, 0.5]] : n === 2 ? [[0.3, 0.62], [0.66, 0.36]]
      : n === 3 ? [[0.26, 0.56], [0.56, 0.3], [0.68, 0.7]] : [[0.24, 0.5], [0.5, 0.24], [0.5, 0.76], [0.76, 0.5]];
    if (travel) {
      for (const index of travel.route.slice(travel.segment + 1)) {
        const { x, y } = tileAt(index);
        put(x, y, () => {
          const p = toScreen(x + 0.5, y + 0.5, topZ(x, y));
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 4, 2.5, 0, 0, 2 * Math.PI);
          ctx.fillStyle = '#fff0b4'; ctx.fill();
          ctx.lineWidth = 1.5; ctx.strokeStyle = '#674a29'; ctx.stroke();
        });
      }
      const { x, y, from, to, fraction, members, elapsed } = travel;
      const tx = Math.floor(x + 0.5), ty = Math.floor(y + 0.5);
      const heading = headingFor(to.x - from.x, to.y - from.y);
      put(tx, ty, () => {
        const startZ = topZ(from.x, from.y), endZ = topZ(to.x, to.y);
        const step = Math.max(0, Math.min(1, (fraction - 0.25) * 2));
        const zb = startZ + (endZ - startZ) * step;
        const formation = spots(members.length);
        members.map((kin, k) => ({ kin, gx: x + formation[k][0], gy: y + formation[k][1] }))
          .sort((p, q) => (p.gx + p.gy) - (q.gx + q.gy))
          .forEach(s => standee({ ...s, tile: tileIndex(tx, ty), members: members.length,
            selected: false, wanderer: false, heading, walkingMs: elapsed }, zb));
      });
    }
    for (const { tile: index, members: occupants } of game.parties) {
      const members = occupants.filter(kin => !travel?.members.includes(kin));
      if (!members.length) continue;
      const { x, y } = tileAt(index);
      put(x, y, () => {
        const zb = topZ(x, y);
        const list = members.map((kin, k): Standee => ({ kin, gx: x + spots(members.length)[k][0], gy: y + spots(members.length)[k][1], tile: index, members: members.length,
          selected: partyTile === index && (members.length === 1 || selectedKin === kin), wanderer: false, heading: 'S' }));
        for (const s of list.sort((p, q) => (p.gx + p.gy) - (q.gx + q.gy))) standee(s, zb);
      });
    }
    const wanderers = v.gate.filter(w => w.kin !== 'mochi');
    if (wanderers.length) put(GATE.x, GATE.y, () => {
      const zb = topZ(GATE.x, GATE.y);
      wanderers.forEach((w, k) => standee({ kin: w.kin, gx: GATE.x + 0.55, gy: GATE.y + 0.25 + (k + 0.5) * 0.5 / wanderers.length, tile: tileIndex(GATE.x, GATE.y), members: 1,
        selected: false, wanderer: true, heading: 'SW' }, zb));
    });

    // Drifting ground mist (iso/mist.ts, after the ?tree basin mist). Each pocket is drawn
    // with the tile under it, so hills in front hide it and it settles into the low ground;
    // it parts around Hero and burns off near lights.
    const mistAmount = MIST_SCALE * mistForPhase(a.phase);
    if (mistAmount > 0.01 && z * TILE_W >= 20) {
      const t = reducedMotion ? 0 : performance.now() / 1000;
      const heroParty = game.parties.find(p => p.members.includes('hero'));
      const heroAt = travel?.members.includes('hero') ? { x: travel.x + 0.5, y: travel.y + 0.5 }
        : heroParty ? { x: tileAt(heroParty.tile).x + 0.5, y: tileAt(heroParty.tile).y + 0.5 } : null;
      const clear = [...(heroAt ? [{ ...heroAt, radius: 1.6 }] : []), ...lights.map(l => ({ x: l.x, y: l.y, radius: l.radius * 0.5 }))];
      const pale: Rgb = a.night ? [150, 168, 200] : [236, 240, 230];
      const k = a.night ? 0 : 0.06 + a.twilight * 0.12;
      const tint = `rgb(${pale.map((v, i) => Math.round(v * (1 - k) + [a.sunColor.r, a.sunColor.g, a.sunColor.b][i] * k)).join(',')})`;
      const glow = a.night ? 0.55 : 0.75 + a.ambient * 0.25;
      for (const m of mistPockets(x0, y0, x1 + 1, y1 + 1, t, mistAmount, clear)) {
        const tx = Math.floor(m.x), ty = Math.floor(m.y);
        if (!onVillageGrid(tx, ty)) continue;
        put(tx, ty, () => {
          const c = toScreen(m.x, m.y, topZ(tx, ty) + m.z);
          const rx = m.r * TILE_W * z / Math.SQRT2, ry = m.r * TILE_H * z / Math.SQRT2 * 1.35;
          ctx.globalAlpha = Math.min(1, m.a * glow);
          ctx.drawImage(mistSprite(tint, Math.abs(m.key) % 4), c.x - rx, c.y - ry, rx * 2, ry * 2);
          ctx.globalAlpha = 1;
        });
      }
    }

    // 2. Raised terrain and objects, back to front.
    for (let s = x0 + y0; s <= x1 + y1; s++) {
      for (let x = Math.max(x0, s - y1); x <= Math.min(x1, s - y0); x++) {
        const y = s - x;
        const tier = tierOf(x, y);
        if (tier > 0) {
          const zt = tier * TIER_STEP, i = local(x, y), lt = { t: light.total[i], w: light.warm[i] };
          const d = diamond(x, y, zt);
          const ze = topZ(x + 1, y), zs = topZ(x, y + 1);
          if (visible(d) || visible([toScreen(x + 1, y + 1, 0)])) {
            const cliff = terrain.cliff.subarray(i * 3, i * 3 + 3);
            if (zs < zt) poly([toScreen(x, y + 1, zs), toScreen(x + 1, y + 1, zs), toScreen(x + 1, y + 1, zt), toScreen(x, y + 1, zt)], lit(cliff, lt.t, lt.w, a, sunFaceS * 0.92), lit(cliff, lt.t, lt.w, a, sunFaceS * 0.92), 0.6);
            if (ze < zt) poly([toScreen(x + 1, y, ze), toScreen(x + 1, y + 1, ze), toScreen(x + 1, y + 1, zt), toScreen(x + 1, y, zt)], lit(cliff, lt.t, lt.w, a, sunFaceE * 0.92), lit(cliff, lt.t, lt.w, a, sunFaceE * 0.92), 0.6);
            groundPaint(x, y, zt, d);
            // A soft lip on the near edges keeps stacked levels readable.
            ctx.beginPath(); ctx.moveTo(d[3].x, d[3].y); ctx.lineTo(d[2].x, d[2].y); ctx.lineTo(d[1].x, d[1].y);
            ctx.strokeStyle = 'rgba(255,248,223,.16)'; ctx.lineWidth = 1; ctx.stroke();
            if (onVillageGrid(x, y)) mark(x, y, zt);
          }
        }
        if (isKnown(x, y) && !objects.has(tileIndex(x, y)) && terrain.height[local(x, y)] >= WATER_BELOW && z > .13) {
          const scatter = valueNoise(x * 3.79 + .4, y * 4.31 + .3, 61);
          if (scatter > .49) {
            const offset = valueNoise(x * 2.33, y * 3.9, 64);
            const url = scatter > .69 ? 'stone-spill-v1.png' : 'manaberry-sparse-standee-empty-v1.png';
            paintedProp(ART + url, x + .18 + offset * .14, y + .68 + offset * .18, topZ(x, y), .11 + offset * .15, .84);
          }
        }
        const list = isKnown(x, y) ? objects.get(tileIndex(x, y)) : undefined;
        if (list) for (const draw of list) draw();
      }
    }

    // Particles, in world space so they sit at the right height over the land: embers
    // lift off flickering lights (campfires, lanterns); after dark, fireflies drift in
    // each light's reach. Motion stops under reduced motion.
    if (!reducedMotion && z * TILE_W >= 48) {
      const t = now / 1000;
      ctx.globalCompositeOperation = 'lighter';
      for (const source of lights) {
        const gz = topZ(Math.floor(source.x), Math.floor(source.y));
        if (source.id.startsWith('campfire')) for (let k = 0; k < 7; k++) {
          const life = (t * 0.55 + k / 7 + source.x * 0.13) % 1;
          const sway = Math.sin(t * 2.1 + k * 1.7) * 0.06 * life;
          const p = toScreen(source.x + sway, source.y - sway * 0.5, gz + 0.12 + life * 0.75);
          ctx.globalAlpha = (1 - life) * 0.85;
          ctx.fillStyle = life < 0.4 ? '#ffd27a' : '#f08a3c';
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, z * TILE_W * 0.012 * (1 - life * 0.6)), 0, Math.PI * 2); ctx.fill();
        }
        if (a.night) for (let k = 0; k < 4; k++) {
          const seed = k * 2.39 + source.x * 0.7 + source.y * 1.3;
          const r = Math.min(source.radius, 2.4) * (0.35 + 0.6 * valueNoise(seed, 3.1, 71));
          const ang = t * (0.18 + 0.1 * k) + seed;
          const p = toScreen(source.x + Math.cos(ang) * r, source.y + Math.sin(ang * 1.3) * r * 0.8, gz + 0.25 + 0.2 * Math.sin(t * 0.9 + seed));
          ctx.globalAlpha = 0.35 + 0.55 * Math.max(0, Math.sin(t * 2.3 + seed * 3));
          ctx.fillStyle = '#e6f59a';
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.2, z * TILE_W * 0.01), 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // The hour's colour grade: the same soft-light wash the top-down map lays over its world.
    const grade = a.night ? 0.38 : a.twilight * 0.34;
    if (grade > 0.01) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = grade;
      ctx.fillStyle = `rgb(${a.sunColor.r},${a.sunColor.g},${a.sunColor.b})`;
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    hits.current = boxes;
  });

  // Sapling motes, embers, fireflies, pool flicker and animated sprites keep the canvas ticking, only when close enough to see them.
  const animate = cam.zoom * TILE_W >= (MIST_SCALE > 0 ? 20 : 48);
  useEffect(() => {
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0, last = 0;
    const tick = (t: number) => {
      if (t - last > 66) { last = t; setImageTick(n => n + 1); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate]);

  // ---------- Camera ----------

  const clampCam = (c: Camera): Camera => ({
    zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, c.zoom)),
    x: Math.max(B.x, Math.min(B.x + B.w, c.x)), y: Math.max(B.y, Math.min(B.y + B.h, c.y)),
  });
  useLayoutEffect(() => {
    if (!manual.current && size.w && size.h) setCam(homeCamera(size.w, size.h, hudSpace));
  }, [size.w, size.h, hudSpace]);
  const panBy = (dx: number, dy: number) => (manual.current = true, setCam(c => {
    const g = unproject(dx / c.zoom, dy / c.zoom, 0);
    return clampCam({ ...c, x: c.x - g.x, y: c.y - g.y });
  }));
  /** Zoom keeping the ground point under (px, py) fixed. */
  const zoomAt = (px: number, py: number, factor: number) => (manual.current = true, setCam(c => {
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, c.zoom * factor));
    const o = project(c.x, c.y, 0);
    const before = unproject((px - size.w / 2) / c.zoom + o.x, (py - size.h / 2) / c.zoom + o.y, 0);
    const after = unproject((px - size.w / 2) / zoom + o.x, (py - size.h / 2) / zoom + o.y, 0);
    return clampCam({ zoom, x: c.x + before.x - after.x, y: c.y + before.y - after.y });
  }));
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const box = el.getBoundingClientRect();
      zoomAt(e.clientX - box.left, e.clientY - box.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });

  const local2 = (e: { clientX: number; clientY: number }) => {
    const box = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragging) return;
    const g: Gesture = gesture.current ?? { pointers: new Map(), start: { x: e.clientX, y: e.clientY }, moved: false };
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pointers.size === 2) {
      const [p, q] = [...g.pointers.values()];
      g.pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), zoom: camRef.current.zoom };
      g.moved = true;
    }
    gesture.current = g;
    swallowClick.current = false;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current;
    const p = local2(e);
    if (!g || !g.pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && !dragging) {
        const hit = hitAt(p.x, p.y);
        const t = hit?.kind === 'tile' || hit?.kind === 'kin' ? hit.tile : hit?.kind === 'feature' ? tileIndex(FEATURES[hit.id].node.x, FEATURES[hit.id].node.y) : null;
        if (t !== hover) { setHover(t); onHover(t); }
      }
      return;
    }
    const prev = g.pointers.get(e.pointerId)!;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pinch && g.pointers.size >= 2) {
      const [a, b] = [...g.pointers.values()];
      const mid = local2({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      const want = g.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / g.pinch.d;
      zoomAt(mid.x, mid.y, want / camRef.current.zoom);
      panBy((e.clientX - prev.x) / 2, (e.clientY - prev.y) / 2);
      return;
    }
    if (!g.moved && Math.hypot(e.clientX - g.start.x, e.clientY - g.start.y) < 6) return;
    if (!g.moved) e.currentTarget.setPointerCapture(e.pointerId);
    g.moved = true;
    panBy(e.clientX - prev.x, e.clientY - prev.y);
  };
  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current;
    if (!g) return;
    g.pointers.delete(e.pointerId);
    if (g.moved) swallowClick.current = true;
    if (!g.pointers.size) gesture.current = null;
    else g.pinch = undefined;
  };

  const act = (hit: Hit, e: React.MouseEvent, anchor: HTMLElement) => {
    if (hit.kind === 'feature') { onFeature(hit.id); return; }
    if (hit.kind === 'wanderer') { onWanderer(hit.kin); inspectKin(hit.kin, anchor); return; }
    if (hit.kind === 'kin') {
      // A different party's kin: treat it as a destination, like the top-down map's party cells.
      if (partyTile !== null && partyTile !== hit.tile) { onParty(hit.tile); return; }
      if (hit.members === 1) onParty(hit.tile); else onKin(hit.tile, hit.kin);
      return;
    }
    const { x, y } = tileAt(hit.tile);
    const f = featureAt(x, y);
    if (f) { onFeature(f); return; }
    onTile(hit.tile, e);
  };
  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (swallowClick.current) { swallowClick.current = false; return; }
    const p = local2(e);
    const hit = hitAt(p.x, p.y);
    if (hit) act(hit, e, e.currentTarget);
  };

  const cursorTile = cursor ?? tileIndex(HERO_START.x, HERO_START.y);
  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const { x, y } = tileAt(cursorTile);
    const moves: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (moves[e.key]) {
      e.preventDefault();
      const nx = x + moves[e.key][0], ny = y + moves[e.key][1];
      if (!onVillageGrid(nx, ny)) return;
      setCursor(tileIndex(nx, ny));
      manual.current = true;
      setCam(c => clampCam({ ...c, x: c.x + (nx + 0.5 - c.x) * 0.25, y: c.y + (ny + 0.5 - c.y) * 0.25 }));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const party = game.parties.find(p => p.tile === cursorTile);
      if (cursor === null) {
        setCursor(cursorTile);
        if (!party) return;
      }
      const synthetic = { nativeEvent: { pointerType: '' } } as unknown as React.MouseEvent;
      if (party && (partyTile === null || partyTile === cursorTile)) act({ kind: 'kin', tile: cursorTile, kin: party.members[0], members: party.members.length }, synthetic, e.currentTarget);
      else act({ kind: 'tile', tile: cursorTile }, synthetic, e.currentTarget);
    } else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(size.w / 2, size.h / 2, 1.2); }
    else if (e.key === '-') { e.preventDefault(); zoomAt(size.w / 2, size.h / 2, 1 / 1.2); }
    else if (e.key === 'Home') { e.preventDefault(); manual.current = false; setCam(homeCamera(size.w, size.h, hudSpace)); }
  };

  // ---------- Labels and descriptions ----------

  const describe = (i: number | null): string => {
    if (i === null) return '';
    const { x, y } = tileAt(i);
    const ref = gridReference(worldCoordinate(x, y));
    if (isSapling(x, y)) return `${ref} · Curious Sapling`;
    const f = featureAt(x, y);
    if (f) return `${ref} · ${SURFACES[f].name}`;
    if (game.den?.tile === i) return `${ref} · ${game.den.dig ? 'Den worksite' : game.den.level === 2 ? 'Improved Den' : 'Simple Den'}`;
    const b = v.plots[i];
    if (b) return `${ref} · ${BUILDINGS[b].name}`;
    if (isGate(x, y)) return `${ref} · The gate`;
    const party = game.parties.find(p => p.tile === i);
    if (party) return `${ref} · ${party.members.map(k => KIN_TOKENS[k].name).join(', ')}`;
    if (!isKnown(x, y)) return `${ref} · Unexplored`;
    if (fogged(x, y, game.rankReached)) return `${ref} · Under fog until Village rank`;
    const tier = tierOf(x, y);
    return `${ref} · ${tier ? `High ground, level ${tier}` : 'Open land'}`;
  };

  const labelsOn = cam.zoom * TILE_W >= 64;
  const labels: { key: string; x: number; y: number; name: string; meta?: string; locked?: boolean }[] = [];
  if (labelsOn) {
    const s = toScreen(SAPLING.x + 0.5, SAPLING.y + 0.5, topZ(SAPLING.x, SAPLING.y) + 0.85);
    labels.push({ key: 'sapling', x: s.x, y: s.y, name: 'Curious Sapling' });
    for (const id of SURFACE_ORDER) {
      const f = FEATURES[id];
      const p = toScreen(f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2, topZ(f.node.x, f.node.y) + 1.15);
      const locked = !surfaceUnlocked(game, id);
      labels.push({ key: id, x: p.x, y: p.y, name: SURFACES[id].name, locked,
        meta: locked ? 'Village rank' : id === 'forest' ? 'Aspen Grove' : `${SURFACES[id].skill} ${masteryLevel(game.mastery[id])}` });
    }
  }
  const status = describe(cursor ?? hover);

  return (
    <div className="vg-iso" ref={wrap} role="region" aria-label="Village map, isometric view">
      <canvas ref={canvas} className="vg-iso-canvas" tabIndex={0} style={{ width: size.w, height: size.h } as CSSProperties}
        aria-label="Village map. Arrow keys move the tile cursor, Enter acts on it, plus and minus zoom, Home recentres."
        title={hover !== null ? describe(hover) : 'Drag to pan · Wheel or pinch to zoom · Tap a tile to act'}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endPointer} onPointerCancel={endPointer}
        onPointerLeave={e => { if (e.pointerType === 'mouse') { setHover(null); onHover(null); } }}
        onClick={onClick} onKeyDown={onKeyDown} onContextMenu={e => e.preventDefault()} onBlur={() => setCursor(null)} />
      {labels.filter(l => l.x > 0 && l.x < size.w && l.y > 0 && l.y < size.h).map(l => (
        <span key={l.key} className={`vg-iso-label is-${l.key}${l.locked ? ' is-locked' : ''}`} style={{ left: l.x, top: l.y }} aria-hidden="true">
          <span className="vg-chip-name">{l.name}</span>{l.meta && <span className="vg-chip-meta">{l.meta}</span>}
        </span>
      ))}
      {status && <output className="vg-iso-status" aria-live="polite">{status}</output>}
    </div>
  );
}

