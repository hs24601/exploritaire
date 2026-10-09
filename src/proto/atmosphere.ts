/** Tilted-camera ambiance: light hanging in the air around lamps, sun rays,
 * fireflies, pond effervescence and drifting motes. Visual only: nothing here
 * feeds game rules, which read the steady values in protoLighting.
 *
 * Particles use CSS motion; their light response and halos share the visual
 * clock. The high tier adds a bounded GPU volume; low retains simple shafts. */
import { DEFAULT_LIGHT_STRENGTH, type TableLight, type TableLightFrame } from './protoLighting';
import { unprojectTilt, type TableTilt } from './tableTilt';
import { atmosphereSky } from './volumetricAtmosphere';

export type FxQuality = 'high' | 'low';

/** `?fx=low` or `?fx=high` picks the tier; otherwise reduced-motion users and
 * small devices (four cores or fewer and under 4GB, where reported) get low. */
export const detectFxQuality = (): FxQuality => {
  if (typeof window === 'undefined') return 'high';
  const forced = new URLSearchParams(window.location.search).get('fx');
  if (forced === 'low' || forced === 'high') return forced;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'low';
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.hardwareConcurrency ?? 8) <= 4 && (nav.deviceMemory ?? 8) < 4) return 'low';
  return 'high';
};

/** How strongly each effect shows at a moment of the day, 0–1. */
export const ambianceFor = (frame: TableLightFrame) => {
  const nightness = 1 - frame.daylight;
  const sky = atmosphereSky(frame);
  return {
    /** Sun shafts: faint at noon, strong at golden hour, gone at night. */
    sunRays: sky.sun * (0.25 + 0.75 * frame.twilight),
    /** Cool moonbeams after dark. */
    moonRays: 1 - sky.sun,
    /** Fireflies come out as the light goes. */
    fireflies: Math.max(0, Math.min(1, (0.55 - frame.daylight) / 0.45)),
    /** Lamp halos glow in the air mostly at night. */
    halos: 0.12 + 0.88 * nightness,
    /** Dust motes catch the sun by day. */
    motes: frame.daylight > 0 ? 0.35 + 0.65 * frame.twilight : 0,
    /** Low mist and smoke: thick at dawn, dusk and night, a trace by day. */
    mist: frame.daylight > 0 ? 0.15 + 0.6 * frame.twilight : 0.55,
  };
};

/** Deterministic pseudo-random sequence, so effects stay put across renders. */
export const seeded = (seed: string) => {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    state ^= state >>> 16;
    return (state >>> 0) / 4294967296;
  };
};

/** A light's halo: how big and bright the glow hanging around it is. Weak
 * carried lights (a candle) give a small, soft glow. Table px. */
export const haloFor = (light: TableLight, strength: number) => {
  const power = Math.min(1, (light.strength ?? DEFAULT_LIGHT_STRENGTH) / DEFAULT_LIGHT_STRENGTH);
  return {
    radius: 18 + (light.radius ?? 2.7) * 9 * Math.sqrt(power),
    /** Height of the glow's centre above the table: at the flame of a lamp
     * token, about chest height on an actor carrying a light, and just above
     * a glowing piece lying on the table. */
    lift: light.fromPiece ? 4 : light.id.startsWith('actor-light-') ? 16 : 20,
    opacity: Math.min(0.85, strength * (0.35 + 0.5 * power)),
  };
};

export type Particle = {
  id: string;
  /** Position on the table, table px. */
  x: number;
  y: number;
  /** Height above the table, table px. */
  lift: number;
  /** Animation length and offset, seconds. */
  duration: number;
  delay: number;
  /** Drift for the loop, table px. */
  dx: number;
  dy: number;
  size: number;
};

/** Particles scattered over an area of the table around a point. */
const particleCache = new Map<string, Particle[]>();
export const scatter = (seed: string, count: number, area: { x: number; y: number; width: number; height: number }, lift: [number, number], drift: number, size: [number, number], duration: [number, number]): Particle[] => {
  const key = JSON.stringify([seed,count,area.x,area.y,area.width,area.height,lift,drift,size,duration]);
  const cached = particleCache.get(key);
  if (cached) return cached;
  const next = seeded(seed);
  const particles = Array.from({ length: count }, (_, index) => ({
    id: `${seed}-${index}`,
    x: area.x + (next() - 0.5) * area.width,
    y: area.y + (next() - 0.5) * area.height,
    lift: lift[0] + next() * (lift[1] - lift[0]),
    duration: duration[0] + next() * (duration[1] - duration[0]),
    delay: -next() * duration[1],
    dx: (next() - 0.5) * 2 * drift,
    dy: (next() - 0.5) * 2 * drift,
    size: size[0] + next() * (size[1] - size[0]),
  }));
  // Bound memory as the camera visits new world cells. Stable cells retain
  // particle identity so React.memo can skip travel/time renders.
  if (particleCache.size >= 256) particleCache.delete(particleCache.keys().next().value!);
  particleCache.set(key,particles);
  return particles;
};

/** Screen angle of the sun's shafts, degrees from vertical: they slant away
 * from the side of the table the sun (or moon) is on. */
export const rayAngle = (frame: TableLightFrame, yaw = 0) => {
  // The sun's side of the screen turns with a spun camera.
  const radians = (yaw * Math.PI) / 180;
  const screenX = frame.source.x * Math.cos(radians) - frame.source.y * Math.sin(radians);
  return Math.max(-38, Math.min(38, -screenX / 480 * 34));
};

export type ParticleKind = 'firefly' | 'fizz' | 'mist' | 'mote';

type EmitterLook = {
  kind: ParticleKind;
  /** Particles per area on the high and low tiers. */
  count: Record<FxQuality, number>;
  lift: [number, number];
  drift: number;
  size: [number, number];
  duration: [number, number];
};

/** An effect that hangs around a biome tile and moves with it. `area` sizes
 * the patch from the tile's footprint: scaled, padded (table px) and shifted
 * toward the back (negative) or front by `offset` tile heights. Effects that
 * could hide a label, like mist, sit behind the tile. */
export type BiomeEmitter = EmitterLook & { area: { scale?: [number, number]; pad?: [number, number]; offset?: number } };

/** An effect spread over the whole world: one patch per `cell` table px,
 * made only for the cells the camera can see. */
export type WorldEmitter = EmitterLook & { cell: number };

/** What each kind of biome gives off. Adding an effect to a biome is a line
 * here; a new kind of particle also needs its look in TableAtmosphere. */
export const BIOME_AMBIANCE: Record<'water' | 'woods' | 'danger', readonly BiomeEmitter[]> = {
  woods: [
    { kind: 'firefly', count: { high: 9, low: 3 }, area: { pad: [72, 60] }, lift: [6, 40], drift: 14, size: [2, 3.2], duration: [5, 9] },
    { kind: 'mist', count: { high: 6, low: 3 }, area: { scale: [1.3, 0.25], offset: -0.62 }, lift: [0, 4], drift: 10, size: [30, 52], duration: [10, 16] },
  ],
  water: [
    { kind: 'firefly', count: { high: 9, low: 3 }, area: { pad: [72, 60] }, lift: [6, 40], drift: 14, size: [2, 3.2], duration: [5, 9] },
    { kind: 'fizz', count: { high: 7, low: 0 }, area: { scale: [0.7, 0.55], offset: 0.05 }, lift: [1, 4], drift: 2, size: [1.6, 2.6], duration: [2.4, 4.2] },
    { kind: 'mist', count: { high: 4, low: 2 }, area: { scale: [1.2, 0.25], offset: -0.62 }, lift: [0, 3], drift: 12, size: [28, 44], duration: [11, 17] },
  ],
  // Dangerous tiles (the Dark Woods): dark red versions of the woods' effects,
  // embers where fireflies would drift and a blood-red mist behind the tile.
  // They show at every hour (DANGER_STRENGTH_FLOOR) and in both cameras, since
  // they warn of a fight.
  danger: [
    { kind: 'firefly', count: { high: 16, low: 7 }, area: { pad: [64, 52] }, lift: [4, 44], drift: 12, size: [2.4, 4.2], duration: [4, 8] },
    { kind: 'mist', count: { high: 9, low: 5 }, area: { scale: [1.5, 0.35], offset: -0.6 }, lift: [0, 5], drift: 10, size: [36, 62], duration: [9, 15] },
  ],
};

/** Danger effects never fade below these strengths, whatever the hour. */
export const DANGER_STRENGTH_FLOOR: Partial<Record<ParticleKind, number>> = { firefly: 0.85, mist: 0.65 };

/** Effects over the whole world, anchored to the table so they pan and zoom
 * with it. */
export const WORLD_AMBIANCE: readonly WorldEmitter[] = [
  { kind: 'mote', cell: 260, count: { high: 2, low: 0 }, lift: [8, 70], drift: 16, size: [1.5, 2.6], duration: [9, 16] },
];

type Area = { x: number; y: number; width: number; height: number };

/** How strongly a kind of particle shows at a moment of the day, 0-1. */
export const particleStrength = (kind: ParticleKind, mood: ReturnType<typeof ambianceFor>) =>
  kind === 'firefly' ? mood.fireflies : kind === 'mote' ? mood.motes : kind === 'mist' ? mood.mist : 1;

/** A biome emitter's patch for a tile footprint. `quarter` (0-3, see
 * viewQuarter) is which tile side faces a spun camera: the patch's depth
 * axis and its back-or-front offset turn with it. */
export const emitterArea = (emitter: BiomeEmitter, tile: Area, quarter = 0): Area => {
  const [sx, sy] = emitter.area.scale ?? [1, 1];
  const [px, py] = emitter.area.pad ?? [0, 0];
  const sideways = quarter % 2 === 1;
  const depth = sideways ? tile.width : tile.height;
  const shift = (emitter.area.offset ?? 0) * depth;
  // Toward the camera is +y at quarter 0, +x at 1, -y at 2, -x at 3.
  const toward = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }][quarter];
  const across = sideways ? tile.height : tile.width;
  const width = across * sx + px, height = depth * sy + py;
  return { x: tile.x + toward.x * shift, y: tile.y + toward.y * shift, width: sideways ? height : width, height: sideways ? width : height };
};

/** The world cells, `cell` table px square, that the camera can see, plus a
 * one-cell margin so particles drifting in from the edge already exist. The
 * far part of a tilted view is capped so a low camera doesn't fill the
 * horizon with cells nobody can make out. */
export const visibleCells = (view: { width: number; height: number }, camera: { x: number; y: number; scale: number; yaw?: number }, tilt: TableTilt | null, cell: number): (Area & { key: string })[] => {
  const radians = (-(camera.yaw ?? 0) * Math.PI) / 180;
  const c = Math.cos(radians), s = Math.sin(radians);
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([cx, cy]) => {
    const screen = { x: (cx * view.width) / 2, y: (cy * view.height) / 2 };
    const plane = tilt ? unprojectTilt(screen, tilt) : screen;
    const capped = { x: plane.x, y: Math.max(plane.y, -view.height * 2.5) };
    // Into the spun frame the camera's x and y are measured in.
    return { x: capped.x * c - capped.y * s, y: capped.x * s + capped.y * c };
  });
  const toWorld = (v: number, offset: number) => (v - offset) / camera.scale;
  const xs = corners.map((c) => toWorld(c.x, camera.x));
  const ys = corners.map((c) => toWorld(c.y, camera.y));
  const cells: (Area & { key: string })[] = [];
  for (let gx = Math.floor(Math.min(...xs) / cell) - 1; gx <= Math.ceil(Math.max(...xs) / cell); gx++)
    for (let gy = Math.floor(Math.min(...ys) / cell) - 1; gy <= Math.ceil(Math.max(...ys) / cell); gy++)
      cells.push({ key: `${gx},${gy}`, x: (gx + 0.5) * cell, y: (gy + 0.5) * cell, width: cell, height: cell });
  return cells;
};

/** Sun or moon shafts anchored along the world's x axis, one slot per
 * `period` table px, for the slots in view (plus `margin` screen px either
 * side for the slant). Screen px from the viewport centre. */
export const shaftSlots = (viewWidth: number, margin: number, camera: { x: number; y?: number; scale: number; yaw?: number }, period: number) => {
  // Spun, the slots run along the screen's x through the table's origin.
  const radians = ((camera.yaw ?? 0) * Math.PI) / 180;
  const sx = camera.x * Math.cos(radians) - (camera.y ?? 0) * Math.sin(radians);
  const from = Math.floor((-viewWidth / 2 - margin - sx) / (camera.scale * period));
  const to = Math.ceil((viewWidth / 2 + margin - sx) / (camera.scale * period));
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => {
    const slot = from + index;
    const next = seeded(`shaft-${slot}`);
    const worldX = (slot + 0.2 + next() * 0.6) * period;
    return { slot, next, worldX, x: sx + worldX * camera.scale };
  });
};
